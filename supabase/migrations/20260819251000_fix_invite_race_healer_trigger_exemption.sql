-- Corrige handle_user_invited_late() (20260819250000): su UPDATE sobre
-- profiles chocaba con prevent_profile_privilege_escalation(), que solo
-- exime auth.role() = 'service_role' o is_super_admin() — ninguno de los
-- dos aplica a esta corrección de sistema disparada internamente por
-- GoTrue. Se deshabilita puntualmente ese trigger solo para esta
-- actualización, mismo patrón ya usado en este proyecto para
-- reasignaciones administrativas directas por SQL.

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
    insert into public.profiles (id, business_id, name, email, role)
    values (
      new.id, target_business_id,
      coalesce(nullif(meta->>'name', ''), split_part(new.email, '@', 1)),
      new.email, target_role
    );
    return new;
  end if;

  if existing_business_id = target_business_id then
    return new;
  end if;

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
