-- Hoja de Producción (secciones 24-26 del spec). El usuario introduce
-- cuánto quiere producir; el sistema calcula el factor de escala y
-- escala automáticamente los componentes. La producción es un snapshot
-- histórico: nunca modifica la receta maestra, y muestra solo
-- componentes DIRECTOS (no expande subrecetas — para producir una
-- subreceta se genera su propia hoja de producción por separado).
--
-- SECURITY INVOKER (por defecto, sin especificar): la lectura de la
-- receta/componentes y la escritura final en productions quedan sujetas
-- a la RLS normal del que llama, igual que el resto del motor.

create or replace function public.generate_production(p_recipe_id uuid, p_requested_quantity numeric)
returns public.productions
language plpgsql
as $$
declare
  v_recipe record;
  v_factor numeric;
  v_components jsonb;
  v_result public.productions;
begin
  select id, business_id, yield_quantity, yield_unit into v_recipe
  from public.recipes
  where id = p_recipe_id;

  if not found then
    raise exception 'Receta no encontrada o sin acceso.';
  end if;

  if v_recipe.yield_quantity is null or v_recipe.yield_quantity <= 0 then
    raise exception 'La receta no tiene rendimiento definido: no se puede generar una hoja de producción.';
  end if;

  if p_requested_quantity is null or p_requested_quantity <= 0 then
    raise exception 'La cantidad a producir debe ser mayor que cero.';
  end if;

  v_factor := p_requested_quantity / v_recipe.yield_quantity;

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
    v_recipe.business_id, p_recipe_id, p_requested_quantity, v_recipe.yield_unit, v_factor, v_components, auth.uid()
  )
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.generate_production(uuid, numeric) is 'Genera una Hoja de Producción: factor = cantidad_deseada / rendimiento_estándar, escala los componentes DIRECTOS de la receta (sin expandir subrecetas) y guarda el snapshot en productions. No modifica la receta maestra. SECURITY INVOKER: falla si la receta no es accesible por RLS, igual que el resto del motor.';
