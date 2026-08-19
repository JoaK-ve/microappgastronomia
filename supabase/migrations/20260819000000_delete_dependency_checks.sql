-- Eliminación segura de ingredientes y recetas.
--
-- La integridad ya estaba protegida a nivel de esquema desde el principio
-- (schema_v1.sql): recipe_components.ingredient_id y
-- recipe_components.component_recipe_id son "on delete restrict", igual que
-- productions.recipe_id — Postgres ya rechaza un DELETE que rompería una
-- receta o un histórico de producción. Lo que falta es explicarle al ADMIN
-- *por qué* se bloqueó, con un mensaje legible, antes de intentar el borrado
-- (no después de un error crudo de Postgres).
--
-- ingredient_equivalences, purchase_formats y price_history SÍ son "on
-- delete cascade" desde ingredients/purchase_formats — son datos propios del
-- ingrediente (no un uso externo), así que se limpian solos al borrar el
-- ingrediente. Aquí solo se informa cuántos formatos de compra se perderían,
-- a título informativo, no como bloqueo.

create or replace function public.get_ingredient_delete_blockers(p_ingredient_id uuid)
returns table(
  used_in_recipe_count integer,
  used_in_recipe_names text[],
  purchase_format_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(distinct rc.recipe_id)::int as used_in_recipe_count,
    coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as used_in_recipe_names,
    (select count(*) from public.purchase_formats pf where pf.ingredient_id = p_ingredient_id)::int as purchase_format_count
  from public.recipe_components rc
  join public.recipes r on r.id = rc.recipe_id
  where rc.ingredient_id = p_ingredient_id;
$$;

comment on function public.get_ingredient_delete_blockers(uuid) is
  'Dependencias reales de un ingrediente antes de borrarlo. used_in_recipe_* bloquea el borrado (FK restrict); purchase_format_count es solo informativo (cascada).';

create or replace function public.get_recipe_delete_blockers(p_recipe_id uuid)
returns table(
  used_as_subrecipe_count integer,
  used_as_subrecipe_names text[],
  production_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(distinct rc.recipe_id)
       from public.recipe_components rc
      where rc.component_recipe_id = p_recipe_id)::int as used_as_subrecipe_count,
    (select coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}')
       from public.recipe_components rc
       join public.recipes r on r.id = rc.recipe_id
      where rc.component_recipe_id = p_recipe_id) as used_as_subrecipe_names,
    (select count(*) from public.productions p where p.recipe_id = p_recipe_id)::int as production_count;
$$;

comment on function public.get_recipe_delete_blockers(uuid) is
  'Dependencias reales de una receta antes de borrarla: uso como subreceta y producciones históricas, ambas "on delete restrict" — este RPC solo explica el motivo con nombres/cantidades antes de intentar el borrado.';
