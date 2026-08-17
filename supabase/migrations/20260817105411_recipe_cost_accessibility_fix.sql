-- Ajuste semántico: compute_recipe_cost(uuid_de_otro_negocio) devolvía
-- {total_cost: 0, is_complete: true} porque RLS bloquea silenciosamente
-- los recipe_components ajenos y el bucle de suma no encuentra nada que
-- sumar. No es una fuga de datos (cero cifras económicas reales
-- expuestas), pero "sin acceso" quedaba indistinguible de "coste 0 real"
-- de una receta vacía legítima. Se añade recipe_found para distinguir
-- los tres estados posibles:
--   - accesible con coste real (incluido 0 si no tiene componentes)
--   - accesible con coste incompleto (falta precio/equivalencia/rendimiento)
--   - inexistente o sin acceso (RLS) -- tratados igual a propósito: no
--     se revela si una receta ajena "existe pero no es tuya" frente a
--     "no existe", eso también sería una fuga de información.

drop type if exists public.recipe_cost_result cascade;
create type public.recipe_cost_result as (
  recipe_found boolean,
  total_cost numeric,
  unit_cost numeric,
  is_complete boolean,
  yield_available boolean,
  missing_reasons text[]
);

comment on type public.recipe_cost_result is 'recipe_found=false cuando la receta no existe O no es accesible por RLS (mismo caso a propósito, no se distingue). Con recipe_found=true: total_cost es NULL solo si algún componente no es calculable; unit_cost es NULL solo si falta el rendimiento.';

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
    result.recipe_found := true;
    result.total_cost := null;
    result.unit_cost := null;
    result.is_complete := false;
    result.yield_available := false;
    result.missing_reasons := array['Ciclo detectado en la cadena de subrecetas.'];
    return result;
  end if;

  select yield_quantity, yield_unit into recipe_yield_qty, recipe_yield_unit
  from public.recipes where id = p_recipe_id;

  if not found then
    result.recipe_found := false;
    result.total_cost := null;
    result.unit_cost := null;
    result.is_complete := false;
    result.yield_available := false;
    result.missing_reasons := array['Receta no encontrada o sin acceso.'];
    return result;
  end if;

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

      if not sub_result.recipe_found then
        reasons := reasons || format('La subreceta "%s" no es accesible.', coalesce(sub_name, 'receta'));
      elsif not sub_result.is_complete then
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

  result.recipe_found := true;
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

comment on function public.compute_recipe_cost(uuid, uuid[]) is 'Coste total y por unidad de rendimiento de una receta, recorriendo ingredientes y subrecetas recursivamente. recipe_found=false si la receta no existe o no es accesible (RLS) -- nunca se confunde con un coste real de 0. NUNCA bloquea por datos incompletos: se reportan en missing_reasons.';

create or replace view public.recipe_costs
with (security_invoker = true)
as
select
  r.id as recipe_id,
  r.business_id,
  c.recipe_found,
  c.total_cost,
  c.unit_cost,
  c.is_complete,
  c.yield_available,
  c.missing_reasons
from public.recipes r
cross join lateral public.compute_recipe_cost(r.id) as c;

comment on view public.recipe_costs is 'Coste total y por unidad de rendimiento de cada receta, ya resuelto (ingredientes + subrecetas recursivamente). Respeta RLS de purchase_formats vía security_invoker: cocina nunca ve costes reales.';
