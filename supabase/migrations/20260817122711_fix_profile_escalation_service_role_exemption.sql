-- El trigger anti-escalada de la migración anterior es un BEFORE UPDATE
-- trigger, no una policy RLS — a diferencia de RLS, los triggers se
-- ejecutan para TODOS los roles, incluido service_role, que no tiene
-- auth.uid() (no hay usuario autenticado en ese contexto). Con el
-- trigger tal cual, get_my_role() devolvía NULL para service_role y el
-- trigger lo bloqueaba también a él — encontrado al intentar corregir
-- datos de prueba con la service key. service_role ya es una credencial
-- de máxima confianza (bypassa RLS por diseño); no tiene sentido que
-- este trigger lo bloquee también.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if (new.role is distinct from old.role or new.business_id is distinct from old.business_id)
     and public.get_my_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede cambiar el rol o el negocio de un usuario.';
  end if;

  return new;
end;
$$;
