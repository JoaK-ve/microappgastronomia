-- Hallazgo de la auditoría (AUDITORIA_OidoChef.md, "Rendimiento y arquitectura"):
-- profiles se filtra por business_id en varios lugares (Configuración →
-- Usuarios, Super Admin → Usuarios del negocio, conteos del dashboard de
-- Super Admin) pero, a diferencia de ingredients/recipes/productions, nunca
-- tuvo su propio índice. Sin impacto real hoy (equipos de pocas personas),
-- pero mantiene el esquema consistente y es barato de prevenir.
create index profiles_business_id_idx on public.profiles (business_id);
