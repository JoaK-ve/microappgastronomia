-- Respaldo y restauración POR NEGOCIO: el admin de un negocio descarga una
-- copia de SUS datos y puede restaurarla.
--
-- Diseño (la restauración escribe y borra datos reales, así que cada
-- decisión está pensada contra eso):
--   * Las dos funciones son SECURITY DEFINER porque la RLS no da a un admin
--     permiso de borrado sobre todas las tablas (productions,
--     price_history, recipe_categories) — y a cambio TODO acceso queda
--     acotado a mano por get_my_business_id(): nunca se lee ni se escribe
--     nada fuera del negocio de quien llama.
--   * Solo admin. Restaurar exige además negocio operativo (SA-3): un
--     negocio suspendido no puede escribir. Descargar no lo exige (datos
--     propios, y la lectura nunca estuvo bloqueada por SA-3).
--   * Todo o nada: una sola transacción. Cualquier error deshace también
--     la copia de seguridad previa.
--   * El archivo solo restaura en el negocio del que salió (business.id de
--     la cabecera). Además business_id se FUERZA al del que llama en cada
--     fila — nunca se confía en el archivo — y los ids se insertan con
--     INSERT plano (jamás upsert): si un archivo manipulado trajera ids de
--     otro negocio, chocaría con la clave primaria y se deshace todo, en
--     vez de pisar nada ajeno.
--   * Antes de reemplazar se guarda una copia del estado actual del negocio
--     en backup.snapshots (reason = 'pre_restore', con quién y cuándo),
--     recuperable por el dueño de la plataforma si alguien restaura el
--     archivo equivocado.
--   * Alcance: recipe_categories, ingredients, ingredient_equivalences,
--     purchase_formats, price_history, ingredient_allergens, recipes,
--     recipe_components, productions. NO toca usuarios, contraseñas,
--     plan/prueba del negocio (un backup viejo no puede "devolver" un
--     trial vigente) ni el logo (Storage).
--   * Genérico a propósito: la exportación usa to_jsonb() de la fila y la
--     restauración inserta las columnas que traiga el archivo, dejando el
--     DEFAULT de las que falten — así una columna nueva en el futuro no se
--     pierde en silencio ni rompe archivos viejos.

-- 1. La copia por negocio comparte tabla con el snapshot diario.
alter table backup.snapshots
  add column if not exists business_id uuid,
  add column if not exists reason text not null default 'daily',
  add column if not exists actor_id uuid;

create index if not exists snapshots_business_id_idx
  on backup.snapshots (business_id) where business_id is not null;

-- 2. Fuente única del alcance y del ORDEN (respeta las claves foráneas:
--    al insertar, padres antes que hijos; al borrar, el orden inverso).
create or replace function backup.restorable_tables()
returns text[]
language sql
immutable
as $$
  select array[
    'recipe_categories', 'ingredients', 'ingredient_equivalences',
    'purchase_formats', 'price_history', 'ingredient_allergens',
    'recipes', 'recipe_components', 'productions'
  ];
$$;

revoke all on function backup.restorable_tables() from public, anon, authenticated;

-- 3. Copia de seguridad de UN negocio (la usa la restauración).
create or replace function backup.take_business_snapshot(
  p_business_id uuid,
  p_reason text,
  p_actor_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = backup, public
as $$
declare
  t text;
  n integer;
  d jsonb;
  total integer := 0;
begin
  foreach t in array backup.restorable_tables() loop
    execute format(
      'select count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.business_id = $1',
      t
    ) into n, d using p_business_id;

    insert into backup.snapshots (table_name, row_count, data, business_id, reason, actor_id)
    values (t, n, d, p_business_id, p_reason, p_actor_id);

    total := total + n;
  end loop;

  return total;
end;
$$;

revoke all on function backup.take_business_snapshot(uuid, text, uuid) from public, anon, authenticated;

-- El snapshot diario ahora marca su motivo, y las copias previas a una
-- restauración se conservan 90 días (más que el diario: son la red de
-- seguridad de una acción humana).
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

    insert into backup.snapshots (table_name, row_count, data, reason)
    values (t.tablename, n, d, 'daily');
    total := total + n;
  end loop;

  delete from backup.snapshots
  where (reason = 'daily' and taken_at < now() - make_interval(days => p_keep_days))
     or (reason <> 'daily' and taken_at < now() - interval '90 days');

  return total;
end;
$$;

revoke all on function backup.take_snapshot(integer) from public, anon, authenticated;

-- 4. Descargar.
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

comment on function public.export_business_backup() is 'Devuelve en un jsonb todos los datos operativos del negocio de quien llama (ingredientes, formatos de compra, recetas, producciones...). Solo admin. Acotada a mano por get_my_business_id().';

-- 5. Restaurar.
create or replace function public.restore_business_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.get_my_business_id();
  v_role public.user_role := public.get_my_role();
  v_tables jsonb;
  v_result jsonb := '{}'::jsonb;
  t text;
  arr jsonb;
  forced jsonb;
  cols text;
  n integer;
  v_bad integer;
begin
  if v_business_id is null then
    raise exception 'Sin negocio asociado a la sesión actual.';
  end if;

  if v_role <> 'admin' then
    raise exception 'Solo un administrador puede restaurar un respaldo.';
  end if;

  if not public.business_is_operational(v_business_id) then
    raise exception 'El negocio no está operativo (trial/gracia vencidos o suspendido).';
  end if;

  if p_backup is null or jsonb_typeof(p_backup) <> 'object' then
    raise exception 'El archivo de respaldo no es válido.';
  end if;

  if p_backup->>'app' is distinct from 'oidochef' then
    raise exception 'Este archivo no es un respaldo de OídoChef.';
  end if;

  if p_backup->>'format_version' is distinct from '1' then
    raise exception 'Este respaldo tiene un formato que esta versión no reconoce.';
  end if;

  if p_backup->'business'->>'id' is distinct from v_business_id::text then
    raise exception 'Este respaldo pertenece a otro negocio: solo se puede restaurar en el negocio del que se descargó.';
  end if;

  v_tables := p_backup->'tables';

  if v_tables is null or jsonb_typeof(v_tables) <> 'object' then
    raise exception 'El respaldo está dañado (faltan las tablas).';
  end if;

  -- Ingredientes y recetas son obligatorios: un archivo sin ellos
  -- vaciaría el negocio entero por un archivo truncado.
  if not (v_tables ? 'ingredients') or not (v_tables ? 'recipes') then
    raise exception 'El respaldo está incompleto (faltan ingredientes o recetas).';
  end if;

  foreach t in array backup.restorable_tables() loop
    if v_tables ? t then
      if jsonb_typeof(v_tables->t) <> 'array' then
        raise exception 'El respaldo está dañado (la tabla % no es válida).', t;
      end if;

      if exists (
        select 1 from jsonb_array_elements(v_tables->t) e where jsonb_typeof(e) <> 'object'
      ) then
        raise exception 'El respaldo está dañado (filas inválidas en %).', t;
      end if;
    end if;
  end loop;

  -- Una restauración a la vez por negocio.
  perform pg_advisory_xact_lock(hashtext('restore_business_backup:' || v_business_id::text));

  -- Red de seguridad: estado actual, antes de tocar nada.
  perform backup.take_business_snapshot(v_business_id, 'pre_restore', auth.uid());

  -- Borrar lo actual, hijos antes que padres.
  for t in
    select u.x from unnest(backup.restorable_tables()) with ordinality as u(x, ord) order by u.ord desc
  loop
    execute format('delete from public.%I where business_id = $1', t) using v_business_id;
  end loop;

  -- Insertar lo del archivo, padres antes que hijos.
  foreach t in array backup.restorable_tables() loop
    arr := coalesce(v_tables->t, '[]'::jsonb);

    -- business_id SIEMPRE el de quien llama, sea lo que diga el archivo.
    select coalesce(jsonb_agg(e || jsonb_build_object('business_id', v_business_id)), '[]'::jsonb)
    into forced
    from jsonb_array_elements(arr) e;

    -- Una producción de alguien que ya no está en el negocio conserva su
    -- historial, sin autor (la clave foránea es on delete set null).
    if t = 'productions' then
      select coalesce(jsonb_agg(
        case
          when exists (
            select 1 from public.profiles p
            where p.id = nullif(e->>'produced_by', '')::uuid and p.business_id = v_business_id
          ) then e
          else e || jsonb_build_object('produced_by', null)
        end
      ), '[]'::jsonb)
      into forced
      from jsonb_array_elements(forced) e;
    end if;

    -- Solo las columnas que trae el archivo: las que falten toman su DEFAULT.
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into cols
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t
      and exists (select 1 from jsonb_array_elements(forced) e where e ? c.column_name);

    if cols is null then
      n := 0;
    else
      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
        t, cols
      ) using forced;
      get diagnostics n = row_count;
    end if;

    if n <> jsonb_array_length(arr) then
      raise exception 'Restauración incompleta en % (esperadas %, insertadas %).', t, jsonb_array_length(arr), n;
    end if;

    v_result := v_result || jsonb_build_object(t, n);
  end loop;

  -- Estas dos tablas no tienen un trigger que compruebe a qué negocio
  -- pertenece lo que referencian (las demás sí): se comprueba aquí.
  select count(*) into v_bad
  from public.price_history ph
  where ph.business_id = v_business_id
    and not exists (
      select 1 from public.purchase_formats pf
      where pf.id = ph.purchase_format_id and pf.business_id = v_business_id
    );

  if v_bad > 0 then
    raise exception 'El respaldo está dañado (historial de precios con referencias ajenas).';
  end if;

  select count(*) into v_bad
  from public.ingredient_allergens ia
  where ia.business_id = v_business_id
    and not exists (
      select 1 from public.ingredients i
      where i.id = ia.ingredient_id and i.business_id = v_business_id
    );

  if v_bad > 0 then
    raise exception 'El respaldo está dañado (alérgenos con referencias ajenas).';
  end if;

  return jsonb_build_object('restored', v_result, 'restored_at', now());
end;
$$;

revoke all on function public.restore_business_backup(jsonb) from public, anon;
grant execute on function public.restore_business_backup(jsonb) to authenticated;

comment on function public.restore_business_backup(jsonb) is 'Reemplaza los datos operativos del negocio de quien llama por los de un respaldo descargado de ESE mismo negocio. Solo admin y negocio operativo. Todo o nada; guarda antes una copia del estado actual en backup.snapshots (reason pre_restore). business_id se fuerza al de la sesión, los ids se insertan sin upsert.';
