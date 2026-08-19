-- SA-4: Super Admin completo / administración de plataforma.
--
-- Extiende lo que ya construyeron SA-1/SA-3 (platform_admins,
-- is_super_admin(), lifecycle) en vez de duplicarlo. Nada de lo de abajo
-- toca ni debilita ninguna policy/trigger existente para ADMIN/COCINA —
-- todo lo nuevo está scoped exclusivamente a is_super_admin().

-- =========================================================================
-- 1) Visibilidad y edición de perfiles para Super Admin (hoy no existía
--    ninguna policy que le permitiera ver o tocar usuarios de un negocio
--    ajeno — "select profiles in own business" lo excluye por completo
--    porque no tiene business_id).
-- =========================================================================

create policy "super admin select all profiles" on public.profiles
  for select using (public.is_super_admin());

create policy "super admin update profiles" on public.profiles
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

-- El trigger anti-escalada (fix_profile_self_escalation.sql) comparaba
-- get_my_role() = 'admin', que para un Super Admin (sin fila en profiles)
-- da NULL y lo habría bloqueado igual que a un usuario normal. Se exime
-- con el mismo patrón que ya usa para service_role.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if (new.role is distinct from old.role or new.business_id is distinct from old.business_id)
     and public.get_my_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede cambiar el rol o el negocio de un usuario.';
  end if;

  return new;
end;
$$;

-- =========================================================================
-- 2) Logo de cualquier negocio: el bucket "logos" solo tenía policies
--    scoped a get_my_business_id(), que para Super Admin es NULL.
-- =========================================================================

create policy "super admin select any business logo" on storage.objects
  for select using (bucket_id = 'logos' and public.is_super_admin());

create policy "super admin insert any business logo" on storage.objects
  for insert with check (bucket_id = 'logos' and public.is_super_admin());

create policy "super admin update any business logo" on storage.objects
  for update using (bucket_id = 'logos' and public.is_super_admin());

create policy "super admin delete any business logo" on storage.objects
  for delete using (bucket_id = 'logos' and public.is_super_admin());

-- =========================================================================
-- 3) Auditoría de plataforma. business_lifecycle_events (SA-3) se queda
--    intacta y exclusiva para cambios de status/trial — no tiene columnas
--    para "qué usuario" ni una acción genérica, así que no puede ampliarse
--    para esto sin desnaturalizarla. platform_audit_log es el complemento,
--    no un segundo sistema paralelo: registra únicamente acciones que el
--    Super Admin ejecuta sobre negocios/usuarios ajenos (editar negocio,
--    invitar, cambiar rol, eliminar, enviar recuperación). La actividad
--    normal de un admin dentro de su propio negocio no se toca ni se
--    audita aquí — sigue funcionando exactamente igual que en V1.4.0.
-- =========================================================================

create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.platform_audit_log is 'Auditoría de acciones de plataforma ejecutadas por un Super Admin sobre negocios/usuarios ajenos (SA-4). Complementa a business_lifecycle_events (SA-3), que sigue siendo la única fuente para cambios de status/trial.';

create index platform_audit_log_business_id_idx on public.platform_audit_log (business_id);
create index platform_audit_log_created_at_idx on public.platform_audit_log (created_at desc);

alter table public.platform_audit_log enable row level security;

create policy "super admin select platform audit log" on public.platform_audit_log
  for select using (public.is_super_admin());

-- Insert solo permitido a sesiones que ya son Super Admin (las RPCs de
-- abajo son security invoker precisamente para quedar sujetas a esta
-- policy como segunda barrera, no solo a su propio chequeo interno). Las
-- Edge Functions insertan aparte con la service key, que ya bypassa RLS.
create policy "super admin insert platform audit log" on public.platform_audit_log
  for insert with check (public.is_super_admin());

-- =========================================================================
-- 4) Protección de "último ADMIN" — condición explícita aprobada por el
--    usuario: ningún negocio puede quedarse sin ningún ADMIN, ni por
--    degradación de rol ni por eliminación. Se aplica en el backend
--    (aquí, y en delete-user), nunca solo en la UI.
-- =========================================================================

create or replace function public.business_admin_count(p_business_id uuid, p_exclude_user_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles
  where business_id = p_business_id
    and role = 'admin'
    and (p_exclude_user_id is null or id <> p_exclude_user_id);
$$;

comment on function public.business_admin_count(uuid, uuid) is 'Cuántos ADMIN tiene un negocio, opcionalmente excluyendo un usuario (para comprobar "¿queda alguno más si saco a este?"). security definer para ser fiable sin depender de la RLS de quien llama.';

-- =========================================================================
-- 5) RPCs de Super Admin: cada una repite su propio chequeo is_super_admin()
--    (defensa en profundidad, mismo patrón que super_admin_activate_business
--    et al. de SA-3) y queda ADEMÁS sujeta a las policies reales de arriba.
-- =========================================================================

create or replace function public.super_admin_update_business_profile(
  p_business_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_logo_url text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede editar los datos de un negocio ajeno.';
  end if;

  update public.businesses
  set name = p_name, phone = p_phone, email = p_email, address = p_address, logo_url = p_logo_url
  where id = p_business_id;

  insert into public.platform_audit_log (actor_id, business_id, action, detail)
  values (auth.uid(), p_business_id, 'business_profile_updated', jsonb_build_object('name', p_name));
end;
$$;

comment on function public.super_admin_update_business_profile(uuid, text, text, text, text, text) is 'Camino de autorización propio del Super Admin para editar datos de CUALQUIER negocio — no reutiliza la policy de auto-edición del admin normal (esa sigue intacta, scoped a su propio negocio).';

create or replace function public.super_admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid;
  v_current_role public.user_role;
begin
  if not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede cambiar el rol de un usuario.';
  end if;

  select business_id, role into v_business_id, v_current_role
  from public.profiles
  where id = p_user_id;

  if v_business_id is null then
    raise exception 'Usuario no encontrado.';
  end if;

  if v_current_role = 'admin' and p_role = 'kitchen'
     and public.business_admin_count(v_business_id, p_user_id) = 0 then
    raise exception 'No se puede cambiar: es el único administrador del negocio. Invita o asciende a otro administrador primero.';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.platform_audit_log (actor_id, business_id, target_user_id, action, detail)
  values (auth.uid(), v_business_id, p_user_id, 'user_role_changed', jsonb_build_object('from', v_current_role, 'to', p_role));
end;
$$;

comment on function public.super_admin_set_user_role(uuid, public.user_role) is 'Cambia el rol admin/cocina de cualquier usuario. Bloquea dejar un negocio sin ningún ADMIN (condición de seguridad aprobada explícitamente) — el backend rechaza la operación aunque la UI lo permitiera.';

-- RPC de registro genérico: cubre acciones de Super Admin que no tienen
-- ningún otro punto de escritura en el backend donde enganchar el insert
-- de auditoría (p. ej. enviar un correo de recuperación es una llamada de
-- Supabase Auth puramente de cliente, sin RPC/Edge Function propia).
create or replace function public.super_admin_log_action(
  p_action text,
  p_business_id uuid default null,
  p_target_user_id uuid default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede registrar esta acción.';
  end if;

  insert into public.platform_audit_log (actor_id, business_id, target_user_id, action, detail)
  values (auth.uid(), p_business_id, p_target_user_id, p_action, p_detail);
end;
$$;

comment on function public.super_admin_log_action(text, uuid, uuid, jsonb) is 'Registro genérico de auditoría para acciones de Super Admin que no pasan por ninguna otra RPC/Edge Function (p. ej. "enviar recuperación de acceso", que es una llamada directa de Supabase Auth desde el cliente).';
