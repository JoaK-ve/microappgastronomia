-- VULNERABILIDAD (encontrada en Fase 9, prueba adversarial de rol cocina):
-- la política "user update own profile" (Fase 2) permite a cualquier
-- usuario actualizar SU PROPIA fila de profiles (USING id = auth.uid())
-- pero, al no tener un WITH CHECK explícito, Postgres reutiliza esa misma
-- condición para validar la fila nueva — que sigue cumpliéndose siempre
-- (el id no cambia). Resultado: un usuario cocina podía hacer
-- PATCH profiles SET role='admin' sobre su propia fila y la RLS lo
-- permitía sin más. Verificado en vivo: escalada exitosa de cocina a
-- admin, y desde ahí acceso completo (incluida la edición del negocio).
--
-- FIX: un trigger BEFORE UPDATE bloquea cualquier cambio de role o
-- business_id salvo que quien ejecuta la actualización sea ya admin
-- (de su propio negocio, vía la política RLS "admin update profiles"
-- ya existente). Un admin sigue pudiendo promover/degradar a otros
-- usuarios de su negocio con normalidad.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.business_id is distinct from old.business_id)
     and public.get_my_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede cambiar el rol o el negocio de un usuario.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_profile_privilege_escalation() is 'Bloquea que un usuario no-admin cambie su propio role o business_id via la policy "user update own profile". Un admin sí puede cambiar el role de otros usuarios de su negocio.';

create trigger trg_profiles_prevent_self_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();
