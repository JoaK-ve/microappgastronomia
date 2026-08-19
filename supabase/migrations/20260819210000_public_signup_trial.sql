-- SA-2: registro público + trial de 14 días.
--
-- El trust boundary ya existía (fix_invite_trust_boundary.sql): la rama de
-- signUp() normal (invited_at is null) SIEMPRE crea un negocio propio e
-- ignora cualquier business_id/role que el cliente intente colar en la
-- metadata, fijando role='admin' desde el propio trigger. Aquí solo se
-- extiende esa misma rama para poblar phone/email/status/fechas de trial
-- usando las columnas ya creadas en SA-1 — no se toca la rama de
-- invitación ni la lógica de trust boundary en sí.

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
    -- Alta nueva por signUp() normal: SIEMPRE se crea un negocio propio,
    -- en estado trial de 14 días. Se ignora deliberadamente cualquier
    -- business_id/role/status que el cliente pudiera haber colado en
    -- options.data — nunca son de fiar aquí, igual que antes.
    insert into public.businesses (name, phone, email, status, trial_started_at, trial_ends_at)
    values (
      coalesce(nullif(meta->>'business_name', ''), split_part(new.email, '@', 1)),
      nullif(meta->>'phone', ''),
      new.email,
      'trial',
      now(),
      now() + interval '14 days'
    )
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

comment on function public.handle_new_user() is 'Alta de negocio (trial 14 días, admin=quien se registra) o alta de usuario invitado (business_id/role vienen del invite-user Edge Function, nunca del cliente). trust boundary: la rama de alta nueva ignora cualquier business_id/role/status en la metadata del cliente.';
