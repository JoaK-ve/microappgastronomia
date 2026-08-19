-- Datos editables del negocio: name/phone/email/address ya existían en
-- `businesses` desde schema_v1.sql (no se añade ninguna columna). Lo único
-- que faltaba era el almacenamiento del logo.
--
-- Bucket privado (no público a propósito): un bucket público en Supabase
-- Storage sirve cualquier objeto por URL directa sin pasar por RLS, lo que
-- rompería el aislamiento por negocio pedido en la tarea. Con el bucket
-- privado, cada logo solo es accesible generando una signed URL desde el
-- cliente autenticado, y esa generación sí pasa por las políticas de abajo.
--
-- Convención de ruta: "{business_id}/logo" (sin extensión, upsert=true al
-- subir) — así reemplazar el logo no deja archivos huérfanos de una
-- extensión anterior. `businesses.logo_url` pasa a guardar esa ruta de
-- almacenamiento, no una URL pública real.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

comment on column public.businesses.logo_url is 'Ruta del objeto en el bucket de Storage "logos" (formato "{business_id}/logo"), NO una URL pública — el bucket es privado. El frontend genera una signed URL bajo demanda.';

create policy "select own business logo" on storage.objects
  for select using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.get_my_business_id()::text
  );

create policy "admin insert own business logo" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.get_my_business_id()::text
    and public.get_my_role() = 'admin'
  );

create policy "admin update own business logo" on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.get_my_business_id()::text
    and public.get_my_role() = 'admin'
  );

create policy "admin delete own business logo" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.get_my_business_id()::text
    and public.get_my_role() = 'admin'
  );
