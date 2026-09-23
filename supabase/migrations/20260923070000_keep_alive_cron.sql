-- Evita que Supabase pause el proyecto por inactividad (plan gratuito: se
-- pausa a los 7 días sin actividad real contra la base de datos).
--
-- Una consulta real y liviana (cuenta los ingredientes) cada 3 días, muy
-- por debajo del umbral de 7 días. Vive dentro de la propia base de datos
-- vía pg_cron — no depende de ninguna llamada externa, así que no hay
-- política de red de ningún sandbox que lo pueda bloquear.
--
-- La extensión pg_cron ya existe (creada en 20260921000000_daily_backup.sql)
-- — se repite aquí `if not exists` solo para que esta migración sea
-- autocontenida si se lee o aplica de forma aislada.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'microappgastronomia-keep-alive',
  '0 6 */3 * *',
  $$select count(*) from public.ingredients;$$
);
