-- Corrección encontrada en la primera prueba de la exportación: se
-- ordenaba por "id", pero ingredient_allergens no tiene esa columna (su
-- clave primaria es (ingredient_id, allergen)) y la descarga fallaba.
-- Se ordena por el contenido de la fila, que sirve para cualquier tabla y
-- da un resultado estable (útil para comparar dos exportaciones).
--
-- Misma definición que en 20260921100000_business_backup_restore.sql
-- (corregida allí también, para que un entorno nuevo nazca bien): esta
-- migración existe para que la base ya desplegada quede igual.

create or replace function public.export_business_backup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.get_my_business_id();
  v_role public.user_role := public.get_my_role();
  v_name text;
  v_tables jsonb := '{}'::jsonb;
  t text;
  d jsonb;
begin
  if v_business_id is null then
    raise exception 'Sin negocio asociado a la sesión actual.';
  end if;

  if v_role <> 'admin' then
    raise exception 'Solo un administrador puede descargar el respaldo.';
  end if;

  select name into v_name from public.businesses where id = v_business_id;

  foreach t in array backup.restorable_tables() loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]''::jsonb) from public.%I x where x.business_id = $1',
      t
    ) into d using v_business_id;

    v_tables := v_tables || jsonb_build_object(t, d);
  end loop;

  return jsonb_build_object(
    'app', 'oidochef',
    'format_version', 1,
    'exported_at', now(),
    'business', jsonb_build_object('id', v_business_id, 'name', v_name),
    'tables', v_tables
  );
end;
$$;

revoke all on function public.export_business_backup() from public, anon;
grant execute on function public.export_business_backup() to authenticated;
