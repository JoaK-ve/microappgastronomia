-- SA-3: ciclo de vida comercial — TRIAL -> GRACE -> SUSPENDED, y ACTIVE
-- indefinido por decisión del Super Admin.
--
-- GRACE nunca se guarda como valor de estado: se CALCULA a partir de
-- trial_ends_at (+7 días) cada vez que hace falta, para que la fuente de
-- verdad sea siempre las fechas reales, nunca un valor que un cron
-- olvidó actualizar (sección 8 del encargo). El enum business_status
-- (creado en SA-1) sigue teniendo 'expired' sin usar — no se elimina
-- (Postgres no permite quitar valores de un enum fácilmente) pero deja
-- de tener sentido en el vocabulario de esta fase: los valores
-- realmente usados en la columna son trial/active/suspended.

create or replace function public.business_is_operational(p_business_id uuid)
returns boolean
language sql
stable
as $$
  select case b.status
    when 'suspended' then false
    when 'active' then true
    when 'trial' then now() <= b.trial_ends_at + interval '7 days'
    else false
  end
  from public.businesses b
  where b.id = p_business_id;
$$;

comment on function public.business_is_operational(uuid) is 'True si el negocio puede usar las funciones normales de la app ahora mismo: active siempre, suspended nunca, trial mientras esté dentro de trial+7 días de gracia (GRACE se calcula aquí, nunca se guarda). NULL/false por defecto si el negocio no es visible para quien llama.';

-- =========================================================================
-- VULNERABILIDAD ENCONTRADA EN LA AUDITORÍA: "admin update own business"
-- (Configuración: nombre/teléfono/logo) no restringe columnas — un admin
-- normal podía en teoría hacer PATCH de su propio status/trial_ends_at
-- por API directa. Se cierra con un trigger, mismo patrón que ya usa
-- prevent_profile_privilege_escalation() para profiles.
-- =========================================================================

create table public.business_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  previous_status public.business_status,
  new_status public.business_status not null,
  created_at timestamptz not null default now()
);

comment on table public.business_lifecycle_events is 'Auditoría mínima de cambios de status de negocio (SA-3 sección 15): quién, qué, cuándo. Se rellena solo desde el trigger de businesses, nunca por inserción directa del cliente.';

alter table public.business_lifecycle_events enable row level security;

create policy "super admin select lifecycle events" on public.business_lifecycle_events
  for select using (public.is_super_admin());

-- Sin policy de insert: solo el trigger (security definer) escribe aquí.

create or replace function public.prevent_business_lifecycle_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if (new.status is distinct from old.status
      or new.trial_started_at is distinct from old.trial_started_at
      or new.trial_ends_at is distinct from old.trial_ends_at)
     and not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede modificar el ciclo de vida comercial del negocio.';
  end if;

  if new.status is distinct from old.status then
    insert into public.business_lifecycle_events (business_id, actor_id, previous_status, new_status)
    values (new.id, auth.uid(), old.status, new.status);
  end if;

  return new;
end;
$$;

comment on function public.prevent_business_lifecycle_tampering() is 'Bloquea que un admin normal cambie status/trial_started_at/trial_ends_at de su propio negocio vía la policy de auto-servicio de Configuración. Solo Super Admin (o service_role, para scripts administrativos) puede tocar estos campos. Registra cada cambio de status en business_lifecycle_events.';

create trigger trg_businesses_prevent_lifecycle_tampering
  before update on public.businesses
  for each row
  execute function public.prevent_business_lifecycle_tampering();

-- =========================================================================
-- Super Admin: policy de UPDATE nueva (no existía ninguna que le permitiera
-- tocar negocios ajenos) + 3 funciones para las acciones del panel.
-- =========================================================================

create policy "super admin update businesses" on public.businesses
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.super_admin_activate_business(p_business_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede activar un negocio.';
  end if;

  update public.businesses
  set status = 'active', suspended_at = null, activated_at = now()
  where id = p_business_id;
end;
$$;

create or replace function public.super_admin_suspend_business(p_business_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede suspender un negocio.';
  end if;

  update public.businesses
  set status = 'suspended', suspended_at = now()
  where id = p_business_id;
end;
$$;

create or replace function public.super_admin_renew_trial(p_business_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede renovar el trial de un negocio.';
  end if;

  -- Nunca se acumula: el nuevo ciclo empieza desde el momento de la
  -- renovación, sin importar si venía de TRIAL, GRACE o SUSPENDED.
  update public.businesses
  set status = 'trial', trial_started_at = now(), trial_ends_at = now() + interval '14 days', suspended_at = null
  where id = p_business_id;
end;
$$;

comment on function public.super_admin_activate_business(uuid) is 'ACTIVE: sin fecha de vencimiento, indefinido hasta que el Super Admin decida suspenderlo.';
comment on function public.super_admin_suspend_business(uuid) is 'SUSPENDED: bloquea acceso operativo (RLS de escritura vía business_is_operational()), nunca borra datos.';
comment on function public.super_admin_renew_trial(uuid) is 'Concede un trial nuevo de 14 días desde ahora mismo, sin acumular tiempo del ciclo anterior.';

-- =========================================================================
-- Bloqueo real del acceso operativo: se añade business_is_operational()
-- a las políticas de escritura del dominio que pide el encargo
-- (ingredientes, recetas, componentes, producciones, categorías, formatos
-- de compra) y a la auto-edición de datos del propio negocio. Las
-- políticas de SELECT no se tocan: los datos siguen siendo legibles
-- (GRACE y SUSPENDED conservan acceso de lectura a propósito).
-- =========================================================================

drop policy "admin update own business" on public.businesses;
create policy "admin update own business" on public.businesses
  for update using (id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(id));

drop policy "admin write ingredients in own business" on public.ingredients;
create policy "admin write ingredients in own business" on public.ingredients
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin update ingredients in own business" on public.ingredients;
create policy "admin update ingredients in own business" on public.ingredients
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin delete ingredients in own business" on public.ingredients;
create policy "admin delete ingredients in own business" on public.ingredients
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin write equivalences in own business" on public.ingredient_equivalences;
create policy "admin write equivalences in own business" on public.ingredient_equivalences
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin update equivalences in own business" on public.ingredient_equivalences;
create policy "admin update equivalences in own business" on public.ingredient_equivalences
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin delete equivalences in own business" on public.ingredient_equivalences;
create policy "admin delete equivalences in own business" on public.ingredient_equivalences
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin write purchase_formats in own business" on public.purchase_formats;
create policy "admin write purchase_formats in own business" on public.purchase_formats
  for insert with check (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin update purchase_formats in own business" on public.purchase_formats;
create policy "admin update purchase_formats in own business" on public.purchase_formats
  for update using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "admin delete purchase_formats in own business" on public.purchase_formats;
create policy "admin delete purchase_formats in own business" on public.purchase_formats
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "insert recipe_categories in own business" on public.recipe_categories;
create policy "insert recipe_categories in own business" on public.recipe_categories
  for insert with check (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

drop policy "write recipes in own business" on public.recipes;
create policy "write recipes in own business" on public.recipes
  for insert with check (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

drop policy "update recipes in own business" on public.recipes;
create policy "update recipes in own business" on public.recipes
  for update using (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

drop policy "admin delete recipes in own business" on public.recipes;
create policy "admin delete recipes in own business" on public.recipes
  for delete using (business_id = public.get_my_business_id() and public.get_my_role() = 'admin' and public.business_is_operational(business_id));

drop policy "write recipe_components in own business" on public.recipe_components;
create policy "write recipe_components in own business" on public.recipe_components
  for insert with check (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

drop policy "update recipe_components in own business" on public.recipe_components;
create policy "update recipe_components in own business" on public.recipe_components
  for update using (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

drop policy "delete recipe_components in own business" on public.recipe_components;
create policy "delete recipe_components in own business" on public.recipe_components
  for delete using (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

drop policy "insert productions in own business" on public.productions;
create policy "insert productions in own business" on public.productions
  for insert with check (business_id = public.get_my_business_id() and public.business_is_operational(business_id));

comment on column public.businesses.status is 'trial/active/suspended son los únicos valores que la app asigna activamente (SA-3). GRACE es un estado calculado (ver business_is_operational), nunca almacenado. expired quedó del enum original de SA-1 sin usar.';
