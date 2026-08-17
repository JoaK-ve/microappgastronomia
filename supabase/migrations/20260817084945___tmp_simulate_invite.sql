-- Función temporal SOLO para pruebas de seguridad de esta sesión. Simula lo
-- que produce auth.admin.inviteUserByEmail() (una fila en auth.users con
-- invited_at fijado) copiando el resto de columnas de un usuario real ya
-- creado, para poder probar el trigger handle_new_user() sin depender del
-- envío real de email (bloqueado ahora mismo por el rate limit de Supabase).
-- Se elimina al terminar las pruebas.
create or replace function public.__tmp_simulate_invite(
  p_new_id uuid,
  p_email text,
  p_business_id uuid,
  p_role text,
  p_name text,
  p_copy_from_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into cols
  from information_schema.columns
  where table_schema = 'auth' and table_name = 'users'
    and is_generated = 'NEVER'
    and column_name not in ('id', 'email', 'invited_at', 'raw_user_meta_data');

  execute format(
    'insert into auth.users (id, email, invited_at, raw_user_meta_data, %s) select %L::uuid, %L, now(), %L::jsonb, %s from auth.users where email = %L limit 1',
    cols,
    p_new_id, p_email,
    jsonb_build_object('business_id', p_business_id, 'role', p_role, 'name', p_name)::text,
    cols,
    p_copy_from_email
  );
end;
$$;
