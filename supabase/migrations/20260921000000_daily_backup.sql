-- Respaldo diario automático dentro de Supabase (pg_cron).
--
-- Cada día a las 03:00 UTC se guarda una copia de TODAS las tablas del
-- esquema public (una fila por tabla y día, con sus filas en jsonb) y se
-- borran las de más de 30 días. Protege contra el error humano —borrar o
-- editar por accidente una receta, un ingrediente, un negocio— que es el
-- riesgo real del día a día.
--
-- LÍMITES (a propósito, para no aparentar más de lo que es):
--   * Vive en la MISMA base de datos: si el proyecto entero se pierde, la
--     copia se pierde con él. No sustituye a un respaldo fuera de Supabase.
--   * No incluye auth.users (los accesos) ni los archivos de Storage
--     (logos): solo los datos del esquema public.
--
-- Los datos NO quedan expuestos por la API: el esquema backup no está en
-- la lista de esquemas expuestos de PostgREST y anon/authenticated no
-- tienen ningún permiso sobre él.
--
-- Restaurar una tabla desde una copia (ejemplo, ingredients del día X):
--   insert into public.ingredients
--   select * from jsonb_populate_recordset(null::public.ingredients,
--     (select data from backup.snapshots
--      where table_name = 'ingredients' and taken_at::date = '2026-09-21'
--      order by taken_at desc limit 1))
--   on conflict (id) do nothing;

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.snapshots (
  id bigserial primary key,
  taken_at timestamptz not null default now(),
  table_name text not null,
  row_count integer not null,
  data jsonb not null
);

create index if not exists snapshots_taken_at_idx on backup.snapshots (taken_at);

revoke all on table backup.snapshots from public, anon, authenticated;
alter table backup.snapshots enable row level security;

create or replace function backup.take_snapshot(p_keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = backup, public
as $$
declare
  t record;
  n integer;
  d jsonb;
  total integer := 0;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public' order by tablename
  loop
    execute format(
      'select count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x',
      t.tablename
    ) into n, d;

    insert into backup.snapshots (table_name, row_count, data) values (t.tablename, n, d);
    total := total + n;
  end loop;

  delete from backup.snapshots where taken_at < now() - make_interval(days => p_keep_days);

  return total;
end;
$$;

revoke all on function backup.take_snapshot(integer) from public, anon, authenticated;

comment on function backup.take_snapshot(integer) is 'Copia todas las tablas de public a backup.snapshots y borra copias de más de p_keep_days días. Devuelve el total de filas copiadas. La invoca el cron diario "daily-snapshot".';

select cron.schedule('daily-snapshot', '0 3 * * *', $$select backup.take_snapshot(30)$$);
