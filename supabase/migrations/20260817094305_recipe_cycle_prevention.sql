-- Una receta puede usar otra receta como componente (subreceta = receta
-- usada por otra, sección 18: no es una entidad aparte). Eso abre la
-- puerta a ciclos indirectos (A usa B, B usa C, C usa A), que el CHECK
-- de auto-referencia directa de la Fase 2 no cubre. Esta migración deja
-- eso resuelto ANTES de construir el motor de costes de la Fase 6, que
-- de otro modo podría entrar en recursión infinita sobre datos inválidos.

-- Devuelve true si, partiendo de p_component_recipe_id y siguiendo todos
-- los componentes de tipo "recipe" de forma transitiva, se llega de vuelta
-- a p_recipe_id — es decir, si añadir p_recipe_id -> p_component_recipe_id
-- cerraría un ciclo (directo o indirecto).
create or replace function public.recipe_component_would_cycle(p_recipe_id uuid, p_component_recipe_id uuid)
returns boolean
language sql
stable
as $$
  with recursive reachable(recipe_id) as (
    select p_component_recipe_id
    union
    select rc.component_recipe_id
    from public.recipe_components rc
    join reachable r on rc.recipe_id = r.recipe_id
    where rc.component_type = 'recipe'
  )
  select exists (select 1 from reachable where recipe_id = p_recipe_id);
$$;

comment on function public.recipe_component_would_cycle(uuid, uuid) is 'true si component_recipe_id ya depende (directa o indirectamente) de recipe_id, es decir, si añadir este componente cerraría un ciclo. Cubre también la auto-referencia directa (el caso trivial de la recursión).';

create or replace function public.check_recipe_component_no_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.component_type = 'recipe' and public.recipe_component_would_cycle(new.recipe_id, new.component_recipe_id) then
    raise exception 'No se puede añadir: crearía una referencia circular entre recetas (directa o indirecta).';
  end if;
  return new;
end;
$$;

create trigger trg_recipe_components_no_cycle
  before insert or update on public.recipe_components
  for each row
  execute function public.check_recipe_component_no_cycle();
