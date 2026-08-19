-- BUG REAL ENCONTRADO DURANTE LAS PRUEBAS DE SA-4 (no introducido por SA-4):
-- una invitación real vía auth.admin.inviteUserByEmail() creó un negocio
-- nuevo y volvió admin al invitado, en vez de unirlo al negocio destino
-- con el rol pedido. Reproducido con un correo real a través de la propia
-- Edge Function invite-user (sin tocar), y aislado con una simulación SQL
-- que demuestra que handle_new_user() decide bien CUANDO invited_at ya
-- está fijado en el momento del INSERT — el problema es de orden de
-- eventos, no de la lógica de la función.
--
-- Diagnóstico: handle_new_user() es AFTER INSERT ON auth.users y decide la
-- rama mirando new.invited_at. En al menos una invitación real observada,
-- GoTrue insertó la fila de auth.users con invited_at todavía NULL y lo
-- fijó después con un UPDATE dentro de la misma operación — el trigger de
-- INSERT ya había tomado (mal) la rama de "alta nueva: crear negocio propio,
-- admin" antes de que invited_at existiera.
--
-- Fix elegido: NO se toca handle_new_user() ni el trigger de INSERT (sigue
-- siendo la única fuente de verdad para el alta normal, ya verificada
-- exhaustivamente en SA-2/SA-3/SA-4 — cambiar su lógica de decisión a otra
-- señal sería arriesgar romper el alta pública, que sí funciona bien hoy).
-- En su lugar, un trigger AFTER UPDATE OF invited_at nuevo corrige la
-- condición de carrera exactamente cuando ocurre: si invited_at pasa de
-- NULL a un valor (transición que SOLO ocurre para invitaciones reales,
-- nunca para un signUp() normal, donde invited_at permanece NULL para
-- siempre) y el perfil ya creado por el trigger de INSERT quedó en un
-- negocio distinto al de la invitación, se reasigna al perfil al negocio
-- y rol correctos y se elimina el negocio huérfano creado por error (solo
-- si no quedó nadie más en él).

create or replace function public.handle_user_invited_late()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  target_business_id uuid;
  target_role public.user_role;
  existing_business_id uuid;
  remaining_in_wrong_business integer;
begin
  -- Solo reacciona a la transición NULL -> valor. Un signUp() normal jamás
  -- toca invited_at, así que este trigger nunca se activa para él.
  if old.invited_at is not null or new.invited_at is null then
    return new;
  end if;

  if not (meta ? 'business_id') then
    raise exception 'Usuario invitado (invited_at recién fijado) sin business_id en la metadata: invite-user debe fijarlo siempre.';
  end if;

  target_business_id := (meta->>'business_id')::uuid;
  target_role := coalesce((meta->>'role')::public.user_role, 'kitchen');

  select business_id into existing_business_id from public.profiles where id = new.id;

  if existing_business_id is null then
    -- El trigger de INSERT no llegó a crear ningún perfil todavía (no
    -- debería pasar, pero se cubre por seguridad).
    insert into public.profiles (id, business_id, name, email, role)
    values (
      new.id, target_business_id,
      coalesce(nullif(meta->>'name', ''), split_part(new.email, '@', 1)),
      new.email, target_role
    );
    return new;
  end if;

  if existing_business_id = target_business_id then
    -- Ya estaba bien (invited_at era visible al insertar) — nada que corregir.
    return new;
  end if;

  -- prevent_profile_privilege_escalation() solo exime auth.role() =
  -- 'service_role' o is_super_admin() — ninguno de los dos aplica aquí:
  -- esta actualización la dispara el propio GoTrue (su conexión no trae
  -- claims de PostgREST) desde un trigger interno, no una sesión de
  -- Super Admin. Se deshabilita puntualmente ese trigger para esta única
  -- corrección de sistema, mismo patrón ya usado en este proyecto para
  -- reasignaciones administrativas directas por SQL.
  alter table public.profiles disable trigger trg_profiles_prevent_self_escalation;

  update public.profiles
  set business_id = target_business_id, role = target_role
  where id = new.id;

  alter table public.profiles enable trigger trg_profiles_prevent_self_escalation;

  select count(*) into remaining_in_wrong_business
  from public.profiles where business_id = existing_business_id;

  if remaining_in_wrong_business = 0 then
    delete from public.businesses where id = existing_business_id;
  end if;

  return new;
end;
$$;

comment on function public.handle_user_invited_late() is 'Corrige la condición de carrera de invited_at (ver migración): si al fijarse invited_at el perfil ya quedó en un negocio equivocado por el trigger de INSERT, lo reasigna al negocio/rol reales de la invitación y limpia el negocio huérfano.';

create trigger trg_auth_users_invited_late
  after update of invited_at on auth.users
  for each row
  execute function public.handle_user_invited_late();
