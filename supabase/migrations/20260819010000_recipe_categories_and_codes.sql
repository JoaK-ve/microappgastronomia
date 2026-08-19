-- Categoría de receta como lista desplegable editable + sugerencia de
-- código, sin tocar el modelo actual: recipes.category y recipes.code
-- SIGUEN siendo texto libre (cero riesgo para las recetas existentes).
-- recipe_categories es solo el vocabulario que alimenta el desplegable;
-- no hay FK desde recipes hacia aquí a propósito, para mantenerlo simple
-- (sección "respetar el modelo actual" del encargo).

create table public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

comment on table public.recipe_categories is 'Vocabulario de categorías de receta por negocio. recipes.category sigue siendo texto libre; esta tabla solo alimenta el selector y evita duplicados/errores de tipeo.';

create unique index recipe_categories_business_id_lower_name_key
  on public.recipe_categories (business_id, lower(name));

alter table public.recipe_categories enable row level security;

create policy "select recipe_categories in own business" on public.recipe_categories
  for select using (business_id = public.get_my_business_id());

-- Sin restricción de rol: igual que "write recipes in own business", tanto
-- ADMIN como COCINA pueden crear/editar recetas y por tanto categorías.
create policy "insert recipe_categories in own business" on public.recipe_categories
  for insert with check (business_id = public.get_my_business_id());

-- Backfill: las categorías ya usadas en recetas existentes (texto libre)
-- quedan disponibles de inmediato en el selector, sin tocar ninguna receta.
insert into public.recipe_categories (business_id, name)
select distinct business_id, btrim(category)
from public.recipes
where category is not null and btrim(category) <> ''
on conflict (business_id, lower(name)) do nothing;

-- Códigos de receta: únicos dentro del negocio (no global), permitiendo
-- múltiples recetas sin código (NULL). No afecta a las recetas existentes:
-- ya son únicas por negocio en los datos actuales.
create unique index recipes_business_id_code_key
  on public.recipes (business_id, code)
  where code is not null;
