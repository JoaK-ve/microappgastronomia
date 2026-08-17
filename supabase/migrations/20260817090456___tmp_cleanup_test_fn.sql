-- Elimina la función de simulación de invitación usada solo para las
-- pruebas de seguridad de esta sesión (ver 20260817084945___tmp_simulate_invite.sql).
drop function if exists public.__tmp_simulate_invite(uuid, text, uuid, text, text, text);
