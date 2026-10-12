-- Hallazgo de la auditoría (AUDITORIA_OidoChef.md, "Errores reales confirmados" #1):
-- guardar los alérgenos de un ingrediente hacía un DELETE y un INSERT como dos
-- llamadas separadas desde el navegador, sin transacción. Si la segunda fallaba
-- (corte de red, pestaña cerrada a mitad) el ingrediente quedaba SIN alérgenos
-- registrados, sin ningún aviso en pantalla — dato de seguridad alimentaria
-- perdido en silencio.
--
-- Esta función hace el reemplazo completo dentro de una sola transacción
-- implícita (toda la función es atómica: si algo falla, Postgres revierte
-- TODO, incluido el borrado). security invoker a propósito: no necesita saltarse
-- RLS, la política existente de ingredient_allergens (admin-only, propio
-- negocio) ya es exactamente la que debe aplicar — así que la sigue
-- respetando tal cual, solo la ejecuta en un solo paso en vez de dos.
create or replace function public.replace_ingredient_allergens(
  p_ingredient_id uuid,
  p_allergens public.allergen[]
)
returns void
language plpgsql
security invoker
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id
  from public.ingredients
  where id = p_ingredient_id;

  if v_business_id is null then
    raise exception 'Ingrediente no encontrado';
  end if;

  delete from public.ingredient_allergens
  where ingredient_id = p_ingredient_id;

  if p_allergens is not null and array_length(p_allergens, 1) > 0 then
    insert into public.ingredient_allergens (ingredient_id, allergen, business_id)
    select p_ingredient_id, a, v_business_id
    from unnest(p_allergens) as a;
  end if;
end;
$$;

comment on function public.replace_ingredient_allergens(uuid, public.allergen[]) is 'Reemplaza el conjunto completo de alérgenos de un ingrediente en una sola transacción (delete+insert atómico) — evita que un fallo a mitad de camino deje el ingrediente sin alérgenos registrados sin aviso. security invoker: respeta la RLS real de ingredient_allergens de quien llama (admin de su propio negocio).';

grant execute on function public.replace_ingredient_allergens(uuid, public.allergen[]) to authenticated;
