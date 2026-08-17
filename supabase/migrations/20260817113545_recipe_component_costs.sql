-- Desglose de coste POR COMPONENTE de una receta, para la Vista Costes
-- (sección 29 del spec: "componentes, cantidades, coste unitario, coste
-- por componente"). compute_recipe_cost() de la Fase 6 solo devuelve el
-- agregado (total/unitario de la receta completa); esto expone el
-- detalle línea a línea reutilizando las mismas piezas del motor
-- (convert_ingredient_quantity, ingredient_unit_cost, compute_recipe_cost
-- para subrecetas) — no es un cálculo nuevo, es la misma lógica expuesta
-- con más granularidad. SECURITY INVOKER (por defecto): RLS de
-- purchase_formats se aplica igual que en el resto del motor.

create or replace function public.get_recipe_component_costs(p_recipe_id uuid)
returns table (
  component_id uuid,
  component_type public.recipe_component_type,
  name text,
  quantity numeric,
  unit public.unit,
  unit_cost numeric,
  component_cost numeric,
  missing_reason text
)
language plpgsql
stable
as $$
declare
  comp record;
  ing_name text;
  ing_usage_unit public.unit;
  ing_cost numeric;
  qty_conv numeric;
  sub_name text;
  sub_result public.recipe_cost_result;
  sub_yield_qty numeric;
  sub_yield_unit public.unit;
  qty_in_sub_yield_unit numeric;
  v_unit_cost numeric;
  v_component_cost numeric;
  v_missing_reason text;
  v_name text;
begin
  for comp in
    select * from public.recipe_components where recipe_id = p_recipe_id order by position
  loop
    v_unit_cost := null;
    v_component_cost := null;
    v_missing_reason := null;

    if comp.component_type = 'ingredient' then
      select i.name, i.usage_unit into ing_name, ing_usage_unit
      from public.ingredients i where i.id = comp.ingredient_id;
      v_name := coalesce(ing_name, 'Ingrediente eliminado');

      ing_cost := public.ingredient_unit_cost(comp.ingredient_id);
      if ing_cost is null then
        v_missing_reason := format('Falta precio actual de "%s".', v_name);
      else
        qty_conv := public.convert_ingredient_quantity(comp.ingredient_id, comp.quantity, comp.unit, ing_usage_unit);
        if qty_conv is null then
          v_missing_reason := format('Falta una equivalencia entre %s y %s para "%s".', comp.unit, ing_usage_unit, v_name);
        else
          v_unit_cost := ing_cost;
          v_component_cost := ing_cost * qty_conv;
        end if;
      end if;

    else
      select r.name, r.yield_quantity, r.yield_unit into sub_name, sub_yield_qty, sub_yield_unit
      from public.recipes r where r.id = comp.component_recipe_id;
      v_name := coalesce(sub_name, 'Receta eliminada');

      sub_result := public.compute_recipe_cost(comp.component_recipe_id, array[p_recipe_id]);

      if not sub_result.recipe_found then
        v_missing_reason := format('La subreceta "%s" no es accesible.', v_name);
      elsif not sub_result.is_complete then
        v_missing_reason := format('La subreceta "%s" tiene coste incompleto.', v_name);
      elsif sub_yield_qty is null then
        v_missing_reason := format('La subreceta "%s" no tiene rendimiento definido.', v_name);
      elsif public.unit_family(comp.unit) <> public.unit_family(sub_yield_unit) then
        v_missing_reason := format('La unidad de este componente no es compatible con el rendimiento de "%s".', v_name);
      else
        v_unit_cost := sub_result.total_cost / sub_yield_qty;
        qty_in_sub_yield_unit := (comp.quantity * public.unit_base_factor(comp.unit)) / public.unit_base_factor(sub_yield_unit);
        v_component_cost := v_unit_cost * qty_in_sub_yield_unit;
      end if;
    end if;

    component_id := comp.id;
    component_type := comp.component_type;
    name := v_name;
    quantity := comp.quantity;
    unit := comp.unit;
    unit_cost := v_unit_cost;
    component_cost := v_component_cost;
    missing_reason := v_missing_reason;

    return next;
  end loop;
end;
$$;

comment on function public.get_recipe_component_costs(uuid) is 'Desglose de coste por componente (ingrediente o subreceta) de una receta, para la Vista Costes. Misma lógica de conversión/equivalencias que compute_recipe_cost, expuesta línea a línea. SECURITY INVOKER: sin RLS en purchase_formats, cada fila queda con unit_cost/component_cost en NULL y missing_reason explicando por qué.';
