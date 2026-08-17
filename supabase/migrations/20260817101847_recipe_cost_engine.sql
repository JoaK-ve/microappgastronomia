-- Motor de costes de recetas (Fase 6). Conecta la cadena completa:
-- ingrediente -> precio vigente -> coste unitario -> receta -> subreceta
-- -> coste total -> coste por rendimiento. Vive en Postgres, SECURITY
-- INVOKER en todo (nada de SECURITY DEFINER aquí): la RLS de
-- purchase_formats sigue aplicándose sola en cada nivel, así que cocina
-- nunca ve un coste real, sin necesidad de comprobar el rol a mano.

-- =========================================================================
-- 1. Conversión de cantidades genérica (reutilizada por purchase_format_
--    unit_cost Y por el motor de recetas — antes esta lógica solo vivía
--    dentro de purchase_format_unit_cost; se extrae aquí para no
--    duplicarla, sección "mantenibilidad" pedida por el usuario).
-- =========================================================================

create or replace function public.convert_ingredient_quantity(
  p_ingredient_id uuid,
  p_quantity numeric,
  p_from_unit public.unit,
  p_to_unit public.unit
)
returns numeric
language plpgsql
stable
as $$
declare
  from_family text := public.unit_family(p_from_unit);
  to_family text := public.unit_family(p_to_unit);
  eq record;
  qty_base numeric;
begin
  if from_family = to_family then
    return (p_quantity * public.unit_base_factor(p_from_unit)) / public.unit_base_factor(p_to_unit);
  end if;

  select e.from_quantity, e.from_unit, e.to_quantity, e.to_unit
  into eq
  from public.ingredient_equivalences e
  where e.ingredient_id = p_ingredient_id
    and (
      (public.unit_family(e.from_unit) = from_family and public.unit_family(e.to_unit) = to_family)
      or
      (public.unit_family(e.to_unit) = from_family and public.unit_family(e.from_unit) = to_family)
    )
  limit 1;

  if not found then
    return null;
  end if;

  qty_base := p_quantity * public.unit_base_factor(p_from_unit);

  if public.unit_family(eq.from_unit) = from_family then
    return (qty_base / (eq.from_quantity * public.unit_base_factor(eq.from_unit)))
      * (eq.to_quantity * public.unit_base_factor(eq.to_unit))
      / public.unit_base_factor(p_to_unit);
  else
    return (qty_base / (eq.to_quantity * public.unit_base_factor(eq.to_unit)))
      * (eq.from_quantity * public.unit_base_factor(eq.from_unit))
      / public.unit_base_factor(p_to_unit);
  end if;
end;
$$;

comment on function public.convert_ingredient_quantity(uuid, numeric, public.unit, public.unit) is 'Convierte una cantidad de una unidad a otra para un ingrediente concreto. Conversión matemática directa si son de la misma familia; si no, exige una ingredient_equivalences de ese ingrediente. NULL si no es convertible — nunca inventa una equivalencia.';

-- purchase_format_unit_cost pasa a apoyarse en la función anterior en vez
-- de repetir la misma lógica de conversión (mismo comportamiento externo,
-- se reverifica con los tests de la Fase 4).
create or replace function public.purchase_format_unit_cost(p_purchase_format_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_quantity numeric;
  v_unit public.unit;
  v_price numeric;
  v_ingredient_id uuid;
  v_usage_unit public.unit;
  qty_in_usage_unit numeric;
begin
  select f.quantity, f.unit, f.price, f.ingredient_id, i.usage_unit
  into v_quantity, v_unit, v_price, v_ingredient_id, v_usage_unit
  from public.purchase_formats f
  join public.ingredients i on i.id = f.ingredient_id
  where f.id = p_purchase_format_id;

  if not found then
    return null;
  end if;

  qty_in_usage_unit := public.convert_ingredient_quantity(v_ingredient_id, v_quantity, v_unit, v_usage_unit);

  if qty_in_usage_unit is null or qty_in_usage_unit = 0 then
    return null;
  end if;

  return v_price / qty_in_usage_unit;
end;
$$;

-- =========================================================================
-- 2. Motor de costes de recetas
-- =========================================================================

drop type if exists public.recipe_cost_result cascade;
create type public.recipe_cost_result as (
  total_cost numeric,
  unit_cost numeric,
  is_complete boolean,
  yield_available boolean,
  missing_reasons text[]
);

comment on type public.recipe_cost_result is 'Resultado del cálculo de coste de una receta. total_cost es NULL si algún componente no es calculable (nunca se muestra un total parcial engañoso — sección 23). unit_cost es NULL si falta el rendimiento, aunque total_cost sí esté disponible.';

-- p_visited: protección defensiva frente a ciclos. La Fase 5 ya los
-- impide al insertar (trigger en recipe_components), esto es una segunda
-- capa: si por lo que sea llegara a existir un ciclo en los datos, el
-- motor lo detecta y lo reporta como dato incompleto en vez de recursar
-- infinitamente.
create or replace function public.compute_recipe_cost(p_recipe_id uuid, p_visited uuid[] default '{}')
returns public.recipe_cost_result
language plpgsql
stable
as $$
declare
  comp record;
  result public.recipe_cost_result;
  component_cost numeric;
  running_total numeric := 0;
  any_missing boolean := false;
  reasons text[] := '{}';
  recipe_yield_qty numeric;
  recipe_yield_unit public.unit;
  ing_name text;
  ing_usage_unit public.unit;
  ing_unit_cost numeric;
  qty_in_usage_unit numeric;
  sub_result public.recipe_cost_result;
  sub_name text;
  sub_yield_qty numeric;
  sub_yield_unit public.unit;
  qty_in_sub_yield_unit numeric;
begin
  if p_recipe_id = any(p_visited) then
    result.total_cost := null;
    result.unit_cost := null;
    result.is_complete := false;
    result.yield_available := false;
    result.missing_reasons := array['Ciclo detectado en la cadena de subrecetas.'];
    return result;
  end if;

  select yield_quantity, yield_unit into recipe_yield_qty, recipe_yield_unit
  from public.recipes where id = p_recipe_id;

  for comp in
    select * from public.recipe_components where recipe_id = p_recipe_id order by position
  loop
    component_cost := null;

    if comp.component_type = 'ingredient' then
      select name, usage_unit into ing_name, ing_usage_unit
      from public.ingredients where id = comp.ingredient_id;

      ing_unit_cost := public.ingredient_unit_cost(comp.ingredient_id);

      if ing_unit_cost is null then
        reasons := reasons || format('Falta precio actual de "%s".', coalesce(ing_name, 'ingrediente'));
      else
        qty_in_usage_unit := public.convert_ingredient_quantity(comp.ingredient_id, comp.quantity, comp.unit, ing_usage_unit);
        if qty_in_usage_unit is null then
          reasons := reasons || format('Falta una equivalencia entre %s y %s para "%s".', comp.unit, ing_usage_unit, coalesce(ing_name, 'ingrediente'));
        else
          component_cost := ing_unit_cost * qty_in_usage_unit;
        end if;
      end if;

    else -- component_type = 'recipe' (subreceta)
      select name, yield_quantity, yield_unit into sub_name, sub_yield_qty, sub_yield_unit
      from public.recipes where id = comp.component_recipe_id;

      sub_result := public.compute_recipe_cost(comp.component_recipe_id, p_visited || p_recipe_id);

      if not sub_result.is_complete then
        reasons := reasons || format('La subreceta "%s" tiene coste incompleto.', coalesce(sub_name, 'receta'));
      elsif sub_yield_qty is null then
        reasons := reasons || format('La subreceta "%s" no tiene rendimiento definido.', coalesce(sub_name, 'receta'));
      elsif public.unit_family(comp.unit) <> public.unit_family(sub_yield_unit) then
        reasons := reasons || format('La unidad de este componente no es compatible con el rendimiento de "%s".', coalesce(sub_name, 'receta'));
      else
        qty_in_sub_yield_unit := (comp.quantity * public.unit_base_factor(comp.unit)) / public.unit_base_factor(sub_yield_unit);
        component_cost := (sub_result.total_cost / sub_yield_qty) * qty_in_sub_yield_unit;
      end if;
    end if;

    if component_cost is null then
      any_missing := true;
    else
      running_total := running_total + component_cost;
    end if;
  end loop;

  result.is_complete := not any_missing;
  result.total_cost := case when any_missing then null else running_total end;
  result.yield_available := recipe_yield_qty is not null;
  result.unit_cost := case
    when result.total_cost is not null and recipe_yield_qty is not null and recipe_yield_qty > 0
    then result.total_cost / recipe_yield_qty
    else null
  end;
  result.missing_reasons := reasons;

  return result;
end;
$$;

comment on function public.compute_recipe_cost(uuid, uuid[]) is 'Coste total y por unidad de rendimiento de una receta, recorriendo ingredientes y subrecetas recursivamente. NUNCA bloquea: datos incompletos se reportan en missing_reasons, total_cost queda en NULL solo si falta algo, unit_cost en NULL solo si falta el rendimiento (independiente entre sí).';

-- =========================================================================
-- 3. Vista para listar recetas con su coste (Vista Costes / lista de
--    recetas). security_invoker=true: sin esto, la vista heredaría los
--    permisos de quien la creó y cocina vería costes reales.
-- =========================================================================

create or replace view public.recipe_costs
with (security_invoker = true)
as
select
  r.id as recipe_id,
  r.business_id,
  c.total_cost,
  c.unit_cost,
  c.is_complete,
  c.yield_available,
  c.missing_reasons
from public.recipes r
cross join lateral public.compute_recipe_cost(r.id) as c;

comment on view public.recipe_costs is 'Coste total y por unidad de rendimiento de cada receta, ya resuelto (ingredientes + subrecetas recursivamente). Respeta RLS de purchase_formats vía security_invoker: cocina nunca ve costes reales.';
