-- Motor de coste por unidad de uso (sección 15 del spec). Vive en Postgres,
-- no en el cliente, para que sea la única fuente de verdad (sección 4).
--
-- Reglas:
-- - Si el formato de compra y la unidad de uso del ingrediente están en la
--   misma "familia" (masa: g/kg, volumen: ml/L, unidades: ud) se hace una
--   conversión matemática directa — nunca hace falta equivalencia.
-- - Si están en familias distintas (ej. compra en "ud", uso en "g") hace
--   falta una ingredient_equivalences para ESE ingrediente que conecte
--   ambas familias. Sin ella, el coste no es calculable (se devuelve NULL,
--   nunca se inventa un dato — sección 23).

create or replace function public.unit_family(u public.unit)
returns text
language sql
immutable
as $$
  select case u
    when 'g' then 'mass'
    when 'kg' then 'mass'
    when 'ml' then 'volume'
    when 'L' then 'volume'
    when 'ud' then 'count'
  end;
$$;

comment on function public.unit_family(public.unit) is 'Familia de la unidad: mass (g/kg), volume (ml/L) o count (ud). Determina si dos unidades se pueden convertir matemáticamente o si hace falta una equivalencia.';

create or replace function public.unit_base_factor(u public.unit)
returns numeric
language sql
immutable
as $$
  select case u
    when 'g' then 1
    when 'kg' then 1000
    when 'ml' then 1
    when 'L' then 1000
    when 'ud' then 1
  end;
$$;

comment on function public.unit_base_factor(public.unit) is 'Cuántas unidades base de su familia equivalen a 1 de esta unidad (g y ml son la base de su familia; ud es su propia base).';

-- Coste por unidad de uso de UN formato de compra concreto. SECURITY
-- INVOKER (el default de Postgres para funciones): las consultas internas
-- a purchase_formats/ingredient_equivalences quedan sujetas a la RLS del
-- que llama, así que un usuario cocina que no tiene SELECT en
-- purchase_formats simplemente obtiene NULL, nunca el coste.
create or replace function public.purchase_format_unit_cost(p_purchase_format_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_quantity numeric;
  v_unit public.unit;
  v_price numeric;
  v_usage_unit public.unit;
  pf_family text;
  usage_family text;
  eq record;
  pf_qty_base numeric;
  qty_in_usage_unit numeric;
begin
  select f.quantity, f.unit, f.price, i.usage_unit
  into v_quantity, v_unit, v_price, v_usage_unit
  from public.purchase_formats f
  join public.ingredients i on i.id = f.ingredient_id
  where f.id = p_purchase_format_id;

  if not found then
    return null;
  end if;

  pf_family := public.unit_family(v_unit);
  usage_family := public.unit_family(v_usage_unit);

  if pf_family = usage_family then
    qty_in_usage_unit := (v_quantity * public.unit_base_factor(v_unit)) / public.unit_base_factor(v_usage_unit);
    return v_price / qty_in_usage_unit;
  end if;

  select e.from_quantity, e.from_unit, e.to_quantity, e.to_unit
  into eq
  from public.ingredient_equivalences e
  join public.purchase_formats f on f.id = p_purchase_format_id
  where e.ingredient_id = f.ingredient_id
    and (
      (public.unit_family(e.from_unit) = pf_family and public.unit_family(e.to_unit) = usage_family)
      or
      (public.unit_family(e.to_unit) = pf_family and public.unit_family(e.from_unit) = usage_family)
    )
  limit 1;

  if not found then
    return null;
  end if;

  pf_qty_base := v_quantity * public.unit_base_factor(v_unit);

  if public.unit_family(eq.from_unit) = pf_family then
    qty_in_usage_unit :=
      (pf_qty_base / (eq.from_quantity * public.unit_base_factor(eq.from_unit)))
      * (eq.to_quantity * public.unit_base_factor(eq.to_unit))
      / public.unit_base_factor(v_usage_unit);
  else
    qty_in_usage_unit :=
      (pf_qty_base / (eq.to_quantity * public.unit_base_factor(eq.to_unit)))
      * (eq.from_quantity * public.unit_base_factor(eq.from_unit))
      / public.unit_base_factor(v_usage_unit);
  end if;

  if qty_in_usage_unit = 0 then
    return null;
  end if;

  return v_price / qty_in_usage_unit;
end;
$$;

comment on function public.purchase_format_unit_cost(uuid) is 'Coste por unidad de uso del ingrediente para un formato de compra concreto. NULL si el formato no existe o si hace falta una equivalencia que no está definida.';

-- Coste "actual" de un ingrediente: el del formato de compra con la fecha
-- de precio más reciente (decisión confirmada con el usuario — "último
-- precio vigente", sección 16).
create or replace function public.ingredient_unit_cost(p_ingredient_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_format_id uuid;
begin
  select id into v_format_id
  from public.purchase_formats
  where ingredient_id = p_ingredient_id
  order by price_date desc, updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return public.purchase_format_unit_cost(v_format_id);
end;
$$;

comment on function public.ingredient_unit_cost(uuid) is 'Coste por unidad de uso del formato de compra más reciente del ingrediente. NULL si no tiene formatos o si el más reciente no es convertible (falta equivalencia).';

-- Vista para la lista de ingredientes (sección 33): coste actual +
-- motivo si no se puede calcular (sección 23, nunca bloquear, siempre
-- explicar qué falta). security_invoker=true es obligatorio aquí: sin
-- esto, una vista hereda por defecto los permisos de quien la CREÓ
-- (postgres), saltándose la RLS de purchase_formats para todo el mundo.
create or replace view public.ingredient_costs
with (security_invoker = true)
as
select
  i.id as ingredient_id,
  i.business_id,
  pf.id as source_purchase_format_id,
  pf.unit as source_unit,
  public.purchase_format_unit_cost(pf.id) as unit_cost,
  case
    when pf.id is null then 'Sin formato de compra. Añade uno para calcular el coste.'
    when public.purchase_format_unit_cost(pf.id) is null then
      'Falta una equivalencia entre ' || pf.unit || ' y ' || i.usage_unit || ' para calcular el coste.'
    else null
  end as missing_reason
from public.ingredients i
left join lateral (
  select *
  from public.purchase_formats f
  where f.ingredient_id = i.id
  order by f.price_date desc, f.updated_at desc
  limit 1
) pf on true;

comment on view public.ingredient_costs is 'Coste por unidad de uso actual de cada ingrediente (formato de precio más reciente) + motivo si falta un dato. Respeta RLS de purchase_formats vía security_invoker: cocina nunca ve el coste.';
