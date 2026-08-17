-- Alta de negocio + primer usuario admin, e invitación de usuarios a un
-- negocio existente. Ambos flujos crean la fila en auth.users desde el
-- cliente (signUp normal, o supabase.auth.admin.inviteUserByEmail desde
-- la Edge Function invite-user) y este trigger crea la fila de negocio
-- (si corresponde) y el perfil correspondiente, en la misma transacción.

create function public.handle_new_user()
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
  if meta ? 'business_id' then
    -- Usuario invitado a un negocio ya existente por un admin.
    target_business_id := (meta->>'business_id')::uuid;
    target_role := coalesce((meta->>'role')::public.user_role, 'kitchen');
  else
    -- Alta nueva: se crea el negocio y este usuario queda como admin.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
