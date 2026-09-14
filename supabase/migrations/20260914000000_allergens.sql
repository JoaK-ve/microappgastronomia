-- Alérgenos: los 14 reconocidos por la UE (Reglamento 1169/2011), el
-- estándar que ya usa La Esquina Caliente por operar en España y que
-- cubre lo relevante para el resto de negocios también.
--
-- El alérgeno se marca por INGREDIENTE (una sola vez, no por receta). La
-- receta nunca guarda su propia lista: se calcula recorriendo sus
-- componentes (ingredientes + subrecetas, recursivamente) exactamente
-- igual que ya hace el motor de costes — mismo patrón, misma protección
-- contra ciclos, ninguna tabla ni motor nuevo que mantener aparte.

create type public.allergen as enum (
  'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja',
  'lacteos', 'frutos_cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos',
  'altramuces', 'moluscos'
);

create table public.ingredient_allergens (
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  allergen public.allergen not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ingredient_id, allergen)
);

create index ingredient_allergens_ingredient_id_idx on public.ingredient_allergens (ingredient_id);

comment on table public.ingredient_allergens is 'Alérgenos (de los 14 de la UE) que contiene un ingrediente. La receta no guarda los suyos: se calculan sumando los de sus componentes vía compute_recipe_allergens/recipe_allergens.';

alter table public.ingredient_allergens enable row level security;

-- Mismo criterio que ingredients: todo el negocio puede ver (es
-- información de seguridad alimentaria, cocina la necesita igual que
-- admin — a diferencia del coste, aquí no hay nada que ocultar), solo
-- admin edita.
create policy "select ingredient allergens in own business" on public.ingredient_allergens
  for select using (business_id = public.get_my_business_id());

create policy "admin write ingredient allergens in own business" on public.ingredient_allergens
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin delete ingredient allergens in own business" on public.ingredient_allergens
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

-- =========================================================================
-- Cálculo recursivo (ingrediente directo + subrecetas), calcado de
-- compute_recipe_cost: mismo p_visited para cortar ciclos, nunca falla
-- ni bloquea — si algo falta simplemente no aporta alérgenos.
-- =========================================================================

create or replace function public.compute_recipe_allergens(p_recipe_id uuid, p_visited uuid[] default '{}')
returns public.allergen[]
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  comp record;
  found public.allergen[];
  result public.allergen[] := '{}';
begin
  if p_recipe_id = any(p_visited) then
    return '{}';
  end if;

  for comp in
    select * from public.recipe_components where recipe_id = p_recipe_id
  loop
    if comp.component_type = 'ingredient' then
      select array_agg(allergen) into found
      from public.ingredient_allergens where ingredient_id = comp.ingredient_id;
    else
      found := public.compute_recipe_allergens(comp.component_recipe_id, p_visited || p_recipe_id);
    end if;

    result := result || coalesce(found, '{}'::public.allergen[]);
  end loop;

  select coalesce(array_agg(distinct a order by a), '{}'::public.allergen[]) into result
  from unnest(result) as a;

  return result;
end;
$$;

comment on function public.compute_recipe_allergens(uuid, uuid[]) is 'Alérgenos de una receta, recorriendo ingredientes y subrecetas recursivamente (mismo patrón que compute_recipe_cost). security invoker: respeta la RLS real de ingredient_allergens de quien llama.';

create or replace view public.recipe_allergens
with (security_invoker = true)
as
select
  r.id as recipe_id,
  r.business_id,
  public.compute_recipe_allergens(r.id) as allergens
from public.recipes r;

comment on view public.recipe_allergens is 'Alérgenos de cada receta, ya resueltos (ingredientes + subrecetas recursivamente). Visible para cualquier rol — a diferencia de recipe_costs, esto no es información financiera.';
