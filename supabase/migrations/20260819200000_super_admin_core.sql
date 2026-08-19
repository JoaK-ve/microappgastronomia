-- SA-1: núcleo del Super Admin de plataforma.
--
-- Decisión de identidad: Super Admin NO es una fila de `profiles` (esa
-- tabla exige business_id not null desde schema_v1.sql — forzar a un
-- Super Admin a "pertenecer" a un negocio contradice el encargo). Se
-- representa con una tabla nueva, completamente separada, sin relación
-- con profiles/business_id: una lista blanca de auth.users.id.
--
-- RLS de platform_admins se activa SIN ninguna política — nadie puede
-- leerla ni escribirla vía la API (ni siquiera un propio Super Admin),
-- ni de forma directa ni disfrazada. La única forma de saber "¿soy
-- Super Admin?" es la función is_super_admin() (security definer, igual
-- patrón que get_my_role()/get_my_business_id()), que sí puede leer la
-- tabla por dentro. Como no existe ninguna policy de INSERT, ningún
-- usuario puede auto-asignarse el rol vía API bajo ninguna circunstancia
-- — solo se puede poblar con acceso directo a la base de datos (esta
-- migración, o el CLI con el rol de servicio).

create table public.platform_admins (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is 'Lista blanca de administradores de PLATAFORMA (OídoChef), sin relación con profiles/business_id a propósito. Sin políticas RLS: inaccesible por API, solo por is_super_admin() o acceso directo a la base de datos.';

alter table public.platform_admins enable row level security;
-- Sin políticas: deny-all vía PostgREST/API. Correcto y deliberado.

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where id = auth.uid());
$$;

comment on function public.is_super_admin() is 'True si el usuario autenticado es Super Admin de plataforma. security definer: puede leer platform_admins aunque esa tabla no tenga políticas RLS para el resto de roles.';

-- =========================================================================
-- Estado y ciclo de vida del negocio (modelo únicamente — sin automatización
-- todavía: SA-2/SA-3 se encargan de trial automático, activación, etc.)
-- =========================================================================

create type public.business_status as enum ('trial', 'active', 'expired', 'suspended');

alter table public.businesses
  add column status public.business_status not null default 'trial',
  add column trial_started_at timestamptz,
  add column trial_ends_at timestamptz,
  add column activated_at timestamptz,
  add column suspended_at timestamptz;

comment on column public.businesses.status is 'Estado de ciclo de vida en la plataforma. Sin automatización todavía (SA-2/SA-3): hoy es solo el modelo.';
comment on column public.businesses.trial_started_at is 'Inicio del periodo de prueba, si lo tuvo/tiene. NULL si nunca pasó por trial (ej. negocios existentes antes de SA-1).';
comment on column public.businesses.trial_ends_at is 'Vencimiento del periodo de prueba, si aplica.';
comment on column public.businesses.activated_at is 'Momento en que el negocio pasó a estado active.';
comment on column public.businesses.suspended_at is 'Momento en que el negocio fue suspendido, si aplica.';

-- Negocios que YA EXISTEN y funcionan de verdad (no son un registro nuevo
-- pasando por trial) se marcan como active desde ya — asignarles "trial"
-- sería inventar un dato comercial falso. activated_at se rellena con su
-- created_at real: es la fecha honesta más cercana a "cuándo empezaron a
-- estar activos", ya que nunca pasaron por un proceso formal de activación.
update public.businesses
set status = 'active', activated_at = created_at
where status = 'trial';

-- =========================================================================
-- RLS: el Super Admin puede leer TODOS los negocios (además de la policy
-- existente "select own business" que ya cubre a los miembros normales).
-- No se toca ni se debilita ninguna policy existente — esta solo añade
-- visibilidad extra, exclusiva para quien is_super_admin() confirme.
-- =========================================================================

create policy "super admin select all businesses" on public.businesses
  for select using (public.is_super_admin());

-- Sembrar el primer Super Admin (cuenta dedicada, sin negocio asociado,
-- confirmado con el usuario: joakchef@gmail.com).
insert into public.platform_admins (id)
values ('682607b4-a96f-4e23-b0b7-49382641040a');
