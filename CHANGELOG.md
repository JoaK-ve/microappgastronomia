# Changelog

Versionado de la **aplicación** (`VMAJOR.MINOR.PATCH`) — independiente
de la versión de cada receta (`recipes.version`). MAJOR solo cambia por
decisión explícita; MINOR y PATCH van de 0 a 20 dentro de V1.

## V1.3.0

SA-3: ciclo de vida comercial — TRIAL → GRACE → SUSPENDED, y ACTIVE.

- Reglas fijas: trial 14 días, gracia 7 días adicionales, active
  indefinido hasta decisión del Super Admin, suspended bloquea el
  acceso operativo sin borrar ningún dato.
- GRACE nunca se guarda como valor de estado — se calcula en vivo a
  partir de `trial_ends_at`, tanto en el backend (`business_is_operational()`)
  como en el frontend, para que nunca queden desincronizados.
- Bloqueo real (no solo visual): las políticas RLS de escritura de
  ingredientes, recetas, componentes, producciones, categorías y
  formatos de compra ahora exigen que el negocio esté operativo —
  intentar la API directamente también queda rechazado.
- Corregida una vulnerabilidad encontrada en la auditoría: la política
  de auto-edición del negocio (Configuración) no restringía columnas y
  permitía en teoría que un admin normal tocara su propio
  status/fechas de trial por API directa. Nuevo trigger lo bloquea.
- Panel de Super Admin: columnas Trial/Gracia, acciones Activar /
  Suspender / Renovar trial (con confirmación), e historial básico de
  cambios de estado por negocio.
- Pantalla de bloqueo completo para negocios suspendidos, y banner de
  aviso durante el periodo de gracia.
- No incluye todavía expiración/suspensión automática por cron, pagos,
  ni modo soporte — eso pertenece a SA-4 en adelante.

## V1.2.0

SA-2: registro público de negocios + trial de 14 días.

- Pantalla pública `/signup` ampliada: teléfono, confirmación de
  contraseña, y aviso claro de "14 días gratis, sin tarjeta".
- Al registrarse, se crea el negocio en estado `trial` con
  `trial_started_at`/`trial_ends_at` (+14 días exactos) y el usuario
  queda como su único ADMIN — usando el mismo trust boundary que ya
  protegía las invitaciones (el backend decide business_id/role/status,
  nunca el cliente).
- Banner discreto "🟢 Prueba gratuita — Te quedan N días" en el sidebar
  mientras el negocio esté en trial.
- El panel de Super Admin ahora ordena los negocios por fecha de
  creación (más nuevo primero) y marca los registrados en las últimas
  24h como "Nuevo" — el aviso de "negocio nuevo registrado" sin
  depender de correo (limitación conocida: sin infraestructura de email
  propia todavía).
- No incluye todavía expiración/bloqueo automático del trial,
  activación o suspensión manual, pagos, ni modo soporte — eso
  pertenece a SA-3 en adelante.

## V1.1.0

Funcionalidades acumuladas desde V1.0.0 que nunca habían tenido su
propio incremento de versión, más el núcleo de Super Admin (SA-1).

- Eliminación segura de ingredientes y recetas, con verificación de
  dependencias reales y diálogo de confirmación reutilizable.
- Categoría de receta como selector editable y sugerencia automática
  de código de receta, ambos con unicidad por negocio.
- Escandallo consolidado: vista admin con el coste de todas las
  recetas de una vez, reutilizando el motor de costes existente.
- Datos del negocio editables (nombre, teléfono, email, dirección) y
  logo con almacenamiento privado por negocio.
- Gestión de usuarios: eliminar usuario (con verificación de negocio e
  integridad del histórico de producción) y contraseñas — cambio
  propio y reseteo por parte de un administrador vía correo.
- Contador de ingredientes y recetas en el Inicio.
- Redondeo de cantidades en la hoja de producción a múltiplos de 5,
  sin decimales.
- **Núcleo de Super Admin (SA-1)**: nueva capa de administración de
  PLATAFORMA, independiente de los negocios — identidad separada
  (`platform_admins`, sin relación con `business_id`), panel de solo
  lectura en `/super-admin` con el listado y la ficha de cada negocio,
  y el modelo de estado/ciclo de vida del negocio (`trial` / `active`
  / `expired` / `suspended`). No incluye todavía registro público,
  trial automático, activación/suspensión manual, avisos ni modo
  soporte — eso llega en fases posteriores (SA-2 en adelante).

## V1.0.0

Primera versión oficial de V1.

- Ingredientes y formatos de compra, con histórico de precios.
- Recetas y subrecetas (una subreceta es simplemente una receta usada
  como componente de otra, sin entidad propia).
- Motor de costes: coste unitario, por componente, total y por unidad
  de rendimiento, recorriendo cadenas de subrecetas.
- Producción: hoja de producción escalada automáticamente, a partir del
  rendimiento o, si no está definido, de la fórmula base de la receta.
- Vistas Cocina / Costes / Producir / Completa de cada receta.
- Autenticación, negocio y roles (administrador / cocina).
- Aislamiento multi-negocio (Row Level Security en toda la base de datos).
- Impresión / PDF vía el navegador.
- Preparación para despliegue en Cloudflare Pages.
