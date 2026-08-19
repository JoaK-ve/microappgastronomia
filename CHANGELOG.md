# Changelog

Versionado de la **aplicación** (`VMAJOR.MINOR.PATCH`) — independiente
de la versión de cada receta (`recipes.version`). MAJOR solo cambia por
decisión explícita; MINOR y PATCH van de 0 a 20 dentro de V1.

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
