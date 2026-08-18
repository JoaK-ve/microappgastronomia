-- Separación conceptual: FÓRMULA ≠ RENDIMIENTO ≠ PRODUCCIÓN.
--
-- Hasta ahora generate_production() exigía yield_quantity/yield_unit
-- para poder producir. Eso acoplaba producción (una operación de
-- cocina) con rendimiento (un dato económico/de estandarización).
-- Una receta debe poder producirse con solo tener una fórmula válida
-- (componentes directos), tenga o no rendimiento declarado.
--
-- yield_quantity/yield_unit NO se eliminan del modelo — siguen siendo
-- la referencia para coste por unidad de rendimiento (compute_recipe_cost
-- no se toca en esta migración). Simplemente dejan de ser obligatorios
-- para producir.
--
-- Cuando no hay rendimiento, la "cantidad base" para calcular el factor
-- de escala pasa a ser la suma de los componentes directos — pero solo
-- tiene sentido sumar si todos comparten familia de unidad (masa,
-- volumen o unidades: la misma clasificación que ya usa el motor de
-- costes vía unit_family/unit_base_factor). Si los componentes mezclan
-- familias (ej. gramos + unidades), no hay una suma con sentido: se
-- informa con claridad en vez de inventar un número.

-- Función de solo lectura que expone la cantidad de referencia (de
-- dónde sale y por qué, o el motivo si no es posible) — la usan tanto
-- generate_production() como el frontend, para mostrar "Rendimiento
-- estándar" o "Cantidad base de la fórmula" ANTES de generar, sin
-- duplicar esta lógica en dos sitios.
create or replace function public.get_recipe_production_reference(p_recipe_id uuid)
returns table (
  reference_quantity numeric,
  reference_unit public.unit,
  source text,
  error_reason text
)
language plpgsql
stable
as $$
declare
  v_yield_quantity numeric;
  v_yield_unit public.unit;
  v_family text;
  v_component_family text;
  v_mixed_families boolean := false;
  v_sum numeric := 0;
  v_has_components boolean := false;
  comp record;
begin
  select yield_quantity, yield_unit into v_yield_quantity, v_yield_unit
  from public.recipes where id = p_recipe_id;

  if not found then
    reference_quantity := null;
    reference_unit := null;
    source := null;
    error_reason := 'Receta no encontrada o sin acceso.';
    return next;
    return;
  end if;

  if v_yield_quantity is not null and v_yield_quantity > 0 then
    reference_quantity := v_yield_quantity;
    reference_unit := v_yield_unit;
    source := 'yield';
    error_reason := null;
    return next;
    return;
  end if;

  for comp in
    select quantity, unit from public.recipe_components where recipe_id = p_recipe_id
  loop
    v_has_components := true;
    v_component_family := public.unit_family(comp.unit);
    if v_family is null then
      v_family := v_component_family;
    elsif v_family <> v_component_family then
      v_mixed_families := true;
    end if;
    v_sum := v_sum + (comp.quantity * public.unit_base_factor(comp.unit));
  end loop;

  if not v_has_components then
    reference_quantity := null;
    reference_unit := null;
    source := null;
    error_reason := 'Esta receta no tiene componentes ni rendimiento definido: no se puede producir.';
    return next;
    return;
  end if;

  if v_mixed_families then
    reference_quantity := null;
    reference_unit := null;
    source := 'formula';
    error_reason := 'Los componentes de esta receta usan unidades de distinta naturaleza (peso/volumen/unidades) y no tiene rendimiento definido: no se puede calcular una cantidad base. Define un rendimiento para poder producirla.';
    return next;
    return;
  end if;

  reference_quantity := v_sum;
  reference_unit := case v_family
    when 'mass' then 'g'
    when 'volume' then 'ml'
    when 'count' then 'ud'
  end::public.unit;
  source := 'formula';
  error_reason := null;
  return next;
end;
$$;

comment on function public.get_recipe_production_reference(uuid) is 'Cantidad de referencia para producir una receta: el rendimiento si está definido, o la suma de los componentes directos (misma familia de unidad) si no. error_reason explica por qué no es posible cuando corresponda. Nunca bloquea silenciosamente: siempre da un motivo.';

-- generate_production() ahora usa get_recipe_production_reference() en
-- vez de exigir yield_quantity directamente. El snapshot guardado en
-- productions.requested_unit refleja la unidad de la referencia usada
-- (rendimiento o fórmula), igual que antes.
create or replace function public.generate_production(p_recipe_id uuid, p_requested_quantity numeric)
returns public.productions
language plpgsql
as $$
declare
  v_business_id uuid;
  v_ref record;
  v_factor numeric;
  v_components jsonb;
  v_result public.productions;
begin
  select business_id into v_business_id
  from public.recipes
  where id = p_recipe_id;

  if not found then
    raise exception 'Receta no encontrada o sin acceso.';
  end if;

  if p_requested_quantity is null or p_requested_quantity <= 0 then
    raise exception 'La cantidad a producir debe ser mayor que cero.';
  end if;

  select * into v_ref from public.get_recipe_production_reference(p_recipe_id);

  if v_ref.error_reason is not null then
    raise exception '%', v_ref.error_reason;
  end if;

  v_factor := p_requested_quantity / v_ref.reference_quantity;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'component_type', rc.component_type,
        'ingredient_id', rc.ingredient_id,
        'component_recipe_id', rc.component_recipe_id,
        'name', coalesce(i.name, r2.name, 'Componente eliminado'),
        'original_quantity', rc.quantity,
        'unit', rc.unit,
        'scaled_quantity', rc.quantity * v_factor
      )
      order by rc.position
    ),
    '[]'::jsonb
  )
  into v_components
  from public.recipe_components rc
  left join public.ingredients i on i.id = rc.ingredient_id
  left join public.recipes r2 on r2.id = rc.component_recipe_id
  where rc.recipe_id = p_recipe_id;

  insert into public.productions (
    business_id, recipe_id, requested_quantity, requested_unit, scale_factor, resulting_components, produced_by
  )
  values (
    v_business_id, p_recipe_id, p_requested_quantity, v_ref.reference_unit, v_factor, v_components, auth.uid()
  )
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.generate_production(uuid, numeric) is 'Genera una Hoja de Producción. Usa el rendimiento de la receta si está definido; si no, usa la suma de los componentes directos como cantidad base (ver get_recipe_production_reference). Nunca modifica la receta maestra. Sigue mostrando solo componentes DIRECTOS, sin desplegar subrecetas.';
