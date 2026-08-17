-- VULNERABILIDAD: handle_new_user() decidía si un signup era "invitación a
-- un negocio existente" únicamente por la PRESENCIA de la clave
-- business_id en raw_user_meta_data. Ese JSON lo controla el cliente al
-- llamar a supabase.auth.signUp({ options: { data: {...} } }) — cualquiera
-- podía enviar business_id (y role) de un negocio ajeno y el trigger lo
-- daba por bueno, entrando en ese negocio sin autorización.
--
-- FIX: la rama de "invitación" ahora exige new.invited_at IS NOT NULL.
-- Esa columna es de auth.users, la fija exclusivamente el servidor de
-- GoTrue cuando el alta viene de auth.admin.inviteUserByEmail() (el único
-- camino, vía la Edge Function invite-user, que ya verifica que quien
-- invita es admin de su propio negocio). El endpoint público de signUp()
-- no tiene forma de fijar invited_at. business_id en la metadata sigue
-- siendo el dato que se usa, pero ya no es la prueba de nada por sí solo:
-- ahora es invited_at quien decide qué rama se ejecuta, y esa columna no
-- la puede falsificar un usuario final.

drop function if exists public.__tmp_check_invited_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  target_business_id uuid;
  target_role public.user_role;
begin
  if new.invited_at is not null then
    -- Invitación real: invited_at solo lo puede fijar el propio Supabase
    -- Auth al procesar admin.inviteUserByEmail(), nunca un signUp() normal.
    if not (meta ? 'business_id') then
      raise exception 'Usuario invitado (invited_at no nulo) sin business_id en la metadata: invite-user debe fijarlo siempre.';
    end if;

    target_business_id := (meta->>'business_id')::uuid;
    target_role := coalesce((meta->>'role')::public.user_role, 'kitchen');
  else
    -- Alta nueva por signUp() normal: SIEMPRE se crea un negocio propio.
    -- Se ignora deliberadamente cualquier business_id/role que el cliente
    -- pudiera haber colado en options.data — nunca son de fiar aquí.
    insert into public.businesses (name)
    values (coalesce(nullif(meta->>'business_name', ''), split_part(new.email, '@', 1)))
    returning id into target_business_id;

    target_role := 'admin';
  end if;

  insert into public.profiles (id, business_id, name, email, role)
  values (
    new.id,
    target_business_id,
    coalesce(nullif(meta->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    target_role
  );

  return new;
end;
$$;
