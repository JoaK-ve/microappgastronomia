# Changelog

Versionado de la **aplicación** (`VMAJOR.MINOR.PATCH`) — independiente
de la versión de cada receta (`recipes.version`). MAJOR solo cambia por
decisión explícita; MINOR y PATCH van de 0 a 20 dentro de V1.

## V1.4.0

IMPORT-ING-1: importador inteligente de ingredientes.

- Nueva pantalla `/ingredientes/importar`, accesible desde "Importar
  ingredientes" junto a "+ Nuevo ingrediente". Flujo obligatorio: fuente
  → análisis → mapeo → previsualización → validación → revisión →
  confirmación → importación → resumen. Nunca se escribe nada en la base
  de datos antes de la confirmación explícita del usuario.
- Fuentes soportadas: Excel (.xlsx, con selector de hoja si hay varias),
  CSV (detecta el separador automáticamente), texto pegado directamente,
  y PDF (extrae texto y detecta estructura de tabla por posición; si no
  hay confianza suficiente — p. ej. un PDF escaneado sin capa de texto —
  no inventa nada y ofrece pegar el contenido como texto en su lugar).
- Mapeo de columnas con detección automática de sinónimos habituales
  (Ingrediente/Nombre/Producto, Precio/Coste/P. compra, Unidad/Ud./U.M.),
  siempre editable antes de continuar; una columna sin mapear queda
  como "Sin utilizar".
- Cada fila queda en uno de seis estados (Nuevo, Existente, Posible
  duplicado, Actualizar, Error, Ignorar), editable individualmente antes
  de importar: se puede corregir nombre/categoría/unidad/precio, excluir
  una fila o resolver un posible duplicado — nunca se fusiona una
  coincidencia ambigua en automático.
- Reutiliza exactamente el modelo y el mecanismo existentes: un
  ingrediente nuevo crea una fila en `ingredients`, un precio (nuevo o
  actualizado) crea una fila en `purchase_formats` — igual que el alta
  manual. No se creó ninguna tabla, motor de coste ni sistema de precios
  nuevo.
- Escritura transaccional mediante una única función `import_ingredients`
  (RPC): procesa solo las filas aprobadas, determina el negocio siempre
  por la sesión (nunca por el archivo ni por el frontend), y queda sujeta
  a la misma RLS que ya protege ingredients/purchase_formats — incluida
  la exigencia de negocio operativo introducida en SA-3 (un negocio
  suspendido no puede importar).
- Nuevas dependencias: `exceljs` (lectura de .xlsx) y `pdfjs-dist`
  (extracción de texto de PDF), cargadas solo bajo demanda al entrar al
  importador (code-splitting), sin afectar al tamaño de carga del resto
  de la aplicación. Se descartó `xlsx` (SheetJS) por un CVE alto sin
  parche en su versión de npm.
- Riesgo residual aceptado (severidad moderada): `exceljs@4.4.0` trae
  `uuid@8.3.2` como única dependencia transitoria, afectado por
  GHSA-w5hq-g745-h8pq ("missing buffer bounds check en v3/v5/v6 cuando
  se pasa un `buf` externo"). Verificado por inspección del paquete
  fuente y del bundle real de producción: `exceljs` solo destructura
  `v4` de `uuid` (nunca v3/v5/v6) y la llama sin argumentos, en un único
  punto — generación de IDs para reglas de formato condicional
  extendidas al *escribir* un .xlsx. El importador de OídoChef solo
  *lee* archivos (`workbook.xlsx.load()`), nunca escribe — ese camino no
  es alcanzable desde ninguna entrada que acepte el importador. No hay
  fix disponible sin un downgrade con breaking change de `exceljs`; no
  se aplicó ningún downgrade ni override de dependencias.

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
