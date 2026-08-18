# Changelog

Versionado de la **aplicación** (`VMAJOR.MINOR.PATCH`) — independiente
de la versión de cada receta (`recipes.version`). MAJOR solo cambia por
decisión explícita; MINOR y PATCH van de 0 a 20 dentro de V1.

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
