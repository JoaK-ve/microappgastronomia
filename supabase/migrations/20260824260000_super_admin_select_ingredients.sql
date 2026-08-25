-- El nuevo dashboard interactivo de Super Admin (V1.6.2) intenta mostrar
-- cuántos ingredientes tiene cada negocio, pero la única policy de SELECT
-- en ingredients está scoped a business_id = get_my_business_id() — para
-- el Super Admin (sin business_id propio) eso da NULL = x, que nunca es
-- true, así que el conteo salía siempre en 0 para todos los negocios,
-- incluido "Tío Pollo DEMO" que realmente tiene 42. No es un bug de la
-- consulta del dashboard: es que nunca se le concedió a Super Admin
-- lectura de ingredients (solo de businesses/profiles hasta ahora).
--
-- Policy nueva, aditiva, mismo patrón que "super admin select all
-- businesses" (SA-1) y "super admin select all profiles" (SA-4): no
-- toca ni debilita la policy existente del admin normal, solo añade
-- visibilidad extra para is_super_admin(). Solo SELECT — el Super Admin
-- sigue sin poder escribir ingredientes de un negocio ajeno.

create policy "super admin select all ingredients" on public.ingredients
  for select using (public.is_super_admin());
