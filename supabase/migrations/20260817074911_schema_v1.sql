-- MicroApp Gastronómica V1 — esquema inicial
-- Entidades: Business, User(profiles), Ingredient, PurchaseFormat, PriceHistory,
-- Recipe, RecipeComponent, Production. Ficha Técnica / Escandallo / Subreceta
-- son vistas y cálculos, no entidades (sección 38 del spec).

-- =========================================================================
-- ENUMS
-- =========================================================================

create type public.user_role as enum ('admin', 'kitchen');
create type public.unit as enum ('g', 'kg', 'ml', 'L', 'ud');
create type public.recipe_component_type as enum ('ingredient', 'recipe');

-- =========================================================================
-- BUSINESSES
-- =========================================================================

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  commercial_name text,
  logo_url text,
  address text,
  phone text,
  email text,
  tax_id text,
  currency text not null default 'EUR',
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.businesses is 'Un negocio gastronómico. Todos los demás datos cuelgan de aquí.';

-- =========================================================================
-- PROFILES (usuarios, 1:1 con auth.users)
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null default 'kitchen',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de negocio de cada usuario autenticado (auth.users). Un usuario pertenece a un único negocio.';

-- Funciones helper para RLS. SECURITY DEFINER + dueño de la tabla (postgres)
-- evita la recursión de RLS que se daría si esta consulta sobre "profiles"
-- estuviera sujeta a las mismas políticas de "profiles".
create function public.get_my_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid();
$$;

create function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- =========================================================================
-- INGREDIENTS
-- =========================================================================

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  category text,
  usage_unit public.unit not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ingredients_business_id_idx on public.ingredients (business_id);

create table public.ingredient_equivalences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  from_quantity numeric not null check (from_quantity > 0),
  from_unit public.unit not null,
  to_quantity numeric not null check (to_quantity > 0),
  to_unit public.unit not null,
  created_at timestamptz not null default now()
);

comment on table public.ingredient_equivalences is 'Equivalencia conocida entre dos unidades para un ingrediente concreto (ej. 1 ud huevo L ≈ 50 g). No son conversiones matemáticas universales (sección 13-14 del spec).';

create index ingredient_equivalences_ingredient_id_idx on public.ingredient_equivalences (ingredient_id);

-- =========================================================================
-- PURCHASE FORMATS + PRICE HISTORY
-- =========================================================================

create table public.purchase_formats (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit public.unit not null,
  price numeric not null check (price >= 0),
  price_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.purchase_formats is 'Precio SIEMPRE vigente por formato de compra (sección 16 del spec: la receta usa el último precio, nunca uno congelado).';

create index purchase_formats_ingredient_id_idx on public.purchase_formats (ingredient_id);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purchase_format_id uuid not null references public.purchase_formats (id) on delete cascade,
  price numeric not null check (price >= 0),
  price_date date not null,
  created_at timestamptz not null default now()
);

comment on table public.price_history is 'Log de precios anteriores. Se rellena automáticamente cuando cambia el precio de un purchase_format (trigger), nunca se edita a mano.';

create index price_history_purchase_format_id_idx on public.price_history (purchase_format_id);

create function public.log_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price is distinct from old.price then
    insert into public.price_history (business_id, purchase_format_id, price, price_date)
    values (old.business_id, old.id, old.price, old.price_date);
  end if;
  return new;
end;
$$;

create trigger trg_log_price_change
  before update on public.purchase_formats
  for each row
  execute function public.log_price_change();

-- =========================================================================
-- RECIPES
-- =========================================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  category text,
  code text,
  status text not null default 'active',
  version integer not null default 1,
  steps jsonb not null default '[]'::jsonb,
  yield_quantity numeric check (yield_quantity > 0),
  yield_unit public.unit,
  conservation_method text,
  conservation_temperature text,
  conservation_shelf_life text,
  conservation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipes is 'Ficha Técnica Maestra (fuente única de verdad, sección 27). Rendimiento puede ser NULL (sección 19): se puede guardar sin él.';
comment on column public.recipes.steps is 'Elaboración: lista ordenada de pasos, ej. ["Mezclar...", "Hornear..."].';

create index recipes_business_id_idx on public.recipes (business_id);

-- =========================================================================
-- RECIPE COMPONENTS (una "subreceta" es solo una receta usada como
-- componente de otra — sección 18 del spec, no es una entidad aparte)
-- =========================================================================

create table public.recipe_components (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  component_type public.recipe_component_type not null,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  component_recipe_id uuid references public.recipes (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit public.unit not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint recipe_components_one_reference check (
    (component_type = 'ingredient' and ingredient_id is not null and component_recipe_id is null)
    or
    (component_type = 'recipe' and component_recipe_id is not null and ingredient_id is null)
  ),
  constraint recipe_components_no_direct_self_reference check (component_recipe_id is distinct from recipe_id)
);

comment on table public.recipe_components is 'Componente de una receta: un ingrediente O una receta (subreceta), nunca ambos. La validación de ciclos indirectos (A usa B, B usa A) se hace en la Fase 6 junto con el motor de costes, no aquí.';

create index recipe_components_recipe_id_idx on public.recipe_components (recipe_id);
create index recipe_components_ingredient_id_idx on public.recipe_components (ingredient_id) where ingredient_id is not null;
create index recipe_components_component_recipe_id_idx on public.recipe_components (component_recipe_id) where component_recipe_id is not null;

-- =========================================================================
-- PRODUCTIONS (ejecución concreta de una receta; nunca modifica la receta)
-- =========================================================================

create table public.productions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  requested_quantity numeric not null check (requested_quantity > 0),
  requested_unit public.unit not null,
  scale_factor numeric not null check (scale_factor > 0),
  resulting_components jsonb not null,
  produced_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.productions is 'Snapshot de una Hoja de Producción (sección 25): receta + cantidad pedida + factor + resultado, congelado en el momento. No altera recipes/recipe_components.';

create index productions_business_id_idx on public.productions (business_id);
create index productions_recipe_id_idx on public.productions (recipe_id);

-- =========================================================================
-- updated_at automático
-- =========================================================================

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger trg_ingredients_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();
create trigger trg_purchase_formats_updated_at before update on public.purchase_formats
  for each row execute function public.set_updated_at();
create trigger trg_recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_equivalences enable row level security;
alter table public.purchase_formats enable row level security;
alter table public.price_history enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_components enable row level security;
alter table public.productions enable row level security;

-- businesses: cualquier miembro puede ver su negocio; solo admin lo edita.
-- No hay policy de INSERT: el alta de negocio + primer admin se hace en la
-- Fase 3 con una función security definer (transacción atómica), no desde
-- el cliente directamente.
create policy "select own business" on public.businesses
  for select using (id = public.get_my_business_id());

create policy "admin update own business" on public.businesses
  for update using (id = public.get_my_business_id() and public.get_my_role() = 'admin');

-- profiles
create policy "select profiles in own business" on public.profiles
  for select using (business_id = public.get_my_business_id());

create policy "admin insert profiles in own business" on public.profiles
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin update profiles in own business" on public.profiles
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "user update own profile" on public.profiles
  for update using (id = auth.uid());

-- ingredients: admin y cocina pueden ver (sin precio, el precio vive en
-- purchase_formats); solo admin escribe.
create policy "select ingredients in own business" on public.ingredients
  for select using (business_id = public.get_my_business_id());

create policy "admin write ingredients in own business" on public.ingredients
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin update ingredients in own business" on public.ingredients
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin delete ingredients in own business" on public.ingredients
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

-- ingredient_equivalences: mismo criterio que ingredients.
create policy "select equivalences in own business" on public.ingredient_equivalences
  for select using (business_id = public.get_my_business_id());

create policy "admin write equivalences in own business" on public.ingredient_equivalences
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin update equivalences in own business" on public.ingredient_equivalences
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin delete equivalences in own business" on public.ingredient_equivalences
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

-- purchase_formats / price_history: información económica. Solo ADMIN,
-- ni siquiera lectura para COCINA (sección 28: la Vista Cocina no debe
-- mostrar coste — se aplica también a nivel de base de datos, no solo UI).
create policy "admin select purchase_formats in own business" on public.purchase_formats
  for select using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin write purchase_formats in own business" on public.purchase_formats
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin update purchase_formats in own business" on public.purchase_formats
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin delete purchase_formats in own business" on public.purchase_formats
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

create policy "admin select price_history in own business" on public.price_history
  for select using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

-- recipes: admin y cocina pueden ver y trabajar con recetas (sección 8).
create policy "select recipes in own business" on public.recipes
  for select using (business_id = public.get_my_business_id());

create policy "write recipes in own business" on public.recipes
  for insert with check (business_id = public.get_my_business_id());

create policy "update recipes in own business" on public.recipes
  for update using (business_id = public.get_my_business_id());

create policy "admin delete recipes in own business" on public.recipes
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin');

-- recipe_components: mismo criterio que recipes (forman parte de la ficha).
create policy "select recipe_components in own business" on public.recipe_components
  for select using (business_id = public.get_my_business_id());

create policy "write recipe_components in own business" on public.recipe_components
  for insert with check (business_id = public.get_my_business_id());

create policy "update recipe_components in own business" on public.recipe_components
  for update using (business_id = public.get_my_business_id());

create policy "delete recipe_components in own business" on public.recipe_components
  for delete using (business_id = public.get_my_business_id());

-- productions: admin y cocina pueden crear y ver producciones (sección 8).
-- Sin policy de update/delete: una producción es un registro histórico,
-- no se edita (si se pidió mal, se crea una nueva).
create policy "select productions in own business" on public.productions
  for select using (business_id = public.get_my_business_id());

create policy "insert productions in own business" on public.productions
  for insert with check (business_id = public.get_my_business_id());
