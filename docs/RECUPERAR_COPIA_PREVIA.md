# Recuperar una restauración equivocada

**Cuándo usarlo:** un admin de un negocio restauró el archivo de respaldo
equivocado (por ejemplo uno de hace un mes) y perdió trabajo reciente.

**Por qué se puede:** antes de reemplazar nada, `restore_business_backup`
guarda una copia del estado que tenía el negocio en `backup.snapshots`
(`reason = 'pre_restore'`). Se conserva **90 días**. El usuario no puede
verla ni recuperarla desde la app; esto lo hace quien tenga acceso a la base
de datos.

**Quién:** el dueño de la plataforma, con el CLI de Supabase ya vinculado al
proyecto. Cada bloque `sql` de abajo se guarda en un archivo y se ejecuta con:

```bash
npx supabase db query --linked -f archivo.sql
```

> Ensayado de punta a punta con datos de prueba el 2026-09-21: recuperación
> exacta (tabla por tabla), recuperación equivocada rechazada sin tocar nada,
> negocio suspendido rechazado, y la propia recuperación deshecha con su copia.

## Paso 1 — Ver qué copias hay

No necesita cambios. Muestra las copias previas de todos los negocios, la más
reciente primero. Busca el negocio por nombre y quédate con dos datos:
`business_id` y `fecha_hora_de_la_copia` (cópala tal cual, con los
microsegundos).

```sql
select b.name as negocio,
       s.business_id,
       s.taken_at as fecha_hora_de_la_copia,
       p.email as quien_restauro,
       sum(s.row_count) as filas_que_tenia
from backup.snapshots s
left join public.businesses b on b.id = s.business_id
left join public.profiles p on p.id = s.actor_id
where s.reason = 'pre_restore'
group by b.name, s.business_id, s.taken_at, p.email
order by s.taken_at desc;
```

**Qué copia elegir:** la que se hizo *justo cuando el admin restauró por error*.
Esa contiene lo que el negocio tenía un instante antes. `filas_que_tenia` te
ayuda a comprobarlo: debería parecerse a lo que el negocio tenía antes del error.

## Paso 2 — Recuperar

Reemplaza los dos valores marcados con `<...>` y ejecuta.

```sql
do $$
declare
  v_biz constant uuid := '<ID_DEL_NEGOCIO>';
  v_taken constant timestamptz := '<FECHA_HORA_DE_LA_COPIA>';
  v_admin uuid;
  v_tables jsonb;
begin
  select id into v_admin
  from public.profiles
  where business_id = v_biz and role = 'admin'
  order by created_at
  limit 1;

  if v_admin is null then
    raise exception 'Ese negocio no tiene ningún administrador.';
  end if;

  select jsonb_object_agg(table_name, data) into v_tables
  from backup.snapshots
  where business_id = v_biz and reason = 'pre_restore' and taken_at = v_taken;

  if v_tables is null then
    raise exception 'No hay una copia previa de ese negocio con esa fecha y hora.';
  end if;

  -- Se ejecuta exactamente el mismo código que la app (restore_business_backup),
  -- con sus mismas comprobaciones, actuando como un admin de ese negocio
  -- solo durante esta transacción.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  perform public.restore_business_backup(jsonb_build_object(
    'app', 'oidochef',
    'format_version', 1,
    'business', jsonb_build_object('id', v_biz),
    'tables', v_tables
  ));
end $$;
```

## Paso 3 — Comprobar

Compara con los números que viste en el Paso 1.

```sql
select (select count(*) from public.ingredients where business_id = '<ID_DEL_NEGOCIO>') as ingredientes,
       (select count(*) from public.recipes where business_id = '<ID_DEL_NEGOCIO>') as recetas,
       (select count(*) from public.productions where business_id = '<ID_DEL_NEGOCIO>') as producciones,
       (select count(*) from public.purchase_formats where business_id = '<ID_DEL_NEGOCIO>') as formatos_de_compra;
```

## Cosas que hay que saber

- **La recuperación también se puede deshacer.** El Paso 2 usa la misma función
  que la app, así que antes de reemplazar guarda una copia de lo que había
  (el estado equivocado). Si te equivocaste de copia, vuelve al Paso 1: ahora
  hay una copia nueva y puedes elegir otra.
- **Todo o nada.** Si algo falla, el negocio queda exactamente como estaba.
- **Si el negocio está suspendido** (o su prueba y gracia vencieron), la
  recuperación se rechaza con *"El negocio no está operativo"*. Reactívalo
  desde el panel de Super Admin, recupera, y vuelve a suspenderlo.
- **En la nueva copia, "quién restauró" saldrá como el admin usado** para
  ejecutar, no como tú. Es esperable.
- **Solo cubre datos operativos** (ingredientes, formatos de compra y precios,
  equivalencias, alérgenos, categorías, recetas, producciones). No devuelve
  usuarios, contraseñas, plan/prueba ni el logo.
- **Caduca a los 90 días.** Pasado ese plazo la copia se borra sola.
- **No sirve si se pierde el proyecto entero**: las copias viven en la misma
  base de datos que los datos. Para eso haría falta una copia fuera de Supabase.
- **No cubre el respaldo diario** (`reason = 'daily'`, todos los negocios
  juntos): usa otro procedimiento que todavía no está ensayado.
