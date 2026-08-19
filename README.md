# MicroApp Gastronómica V1

Recetario + Escandallo + Fichas Técnicas + Hoja de Producción para chefs,
cocineros y pequeños negocios gastronómicos.

Especificación funcional: Documento Maestro — MicroApp Gastronómica V0.4.

## Versión actual

**V1.5.0**

Esquema `VMAJOR.MINOR.PATCH` (versión de la **aplicación**, no de las
recetas — son conceptos independientes; la versión de cada receta vive
en `recipes.version`):

- **MAJOR** — generación principal del producto. Solo cambia por decisión
  explícita, nunca automáticamente.
- **MINOR** (0–20) — cambio o mejora de impacto medio.
- **PATCH** (0–20) — corrección o ajuste menor.

La fuente única de verdad es `package.json` (`version`); Vite la inyecta
en el frontend en tiempo de build (`src/lib/version.ts`). Se muestra de
forma discreta en la parte inferior del menú principal. Historial de
cambios en [`CHANGELOG.md`](./CHANGELOG.md).

## Stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS v4, React Router.
- **Backend/datos:** Supabase (Postgres, Auth, Row Level Security). El motor
  de costes vive en Postgres (funciones SQL), no en el cliente.
- **Hosting:** Cloudflare Pages.
- **Tests:** Vitest + Testing Library.

## Estructura del proyecto

```
src/
  app/              # layout, router y protección de rutas
  features/         # una carpeta por sección de negocio
    auth/           # login, registro, sesión
    home/
    ingredients/
    recipes/
      views/        # Cocina / Costes / Producir / Completa (misma receta, sin duplicar datos)
    production/
    settings/       # negocio, usuarios (solo admin)
  lib/
    supabase.ts     # cliente Supabase
  types/            # tipos compartidos
  test/             # setup de Vitest
supabase/
  migrations/       # esquema SQL versionado (RLS, motor de costes, producción)
  functions/        # Edge Functions (invite-user)
```

## Desarrollo local

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env   # completar con las credenciales de tu proyecto Supabase
npm run dev
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon) del proyecto Supabase |

## Supabase

El esquema de base de datos vive versionado en `supabase/migrations/`.
Todas las tablas de negocio tienen Row Level Security activado: un usuario
solo puede leer o escribir datos de su propio negocio, verificado en la
base de datos (no solo en el frontend).

## Tests

```bash
npm run test
```

## Despliegue

Build de producción:

```bash
npm run build
```

Salida en `dist/`. El proyecto es una SPA: `public/_redirects` (copiado a
`dist/` en cada build) hace que Cloudflare Pages sirva `index.html` para
cualquier ruta (`/recetas/:id`, etc.), necesario para que las rutas de
React Router funcionen al recargar o compartir un enlace directo.

Desplegar en Cloudflare Pages:

```bash
npx wrangler pages deploy dist --project-name microappgastronomia
```

La primera vez, `wrangler` pedirá confirmar la creación del proyecto en
Cloudflare. Variables de entorno (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) se necesitan en **tiempo de build**, no en
runtime (Vite las incrusta en el bundle) — configúralas como variables
de build en el proyecto de Cloudflare Pages, o expórtalas antes de
`npm run build` en tu pipeline de CI.

**Nunca** despliegues la `service_role` key de Supabase en el frontend —
solo la usan las migraciones (vía CLI, en tu máquina) y la Edge Function
`invite-user` (donde Supabase la inyecta automáticamente en tiempo de
ejecución, nunca en el bundle del cliente).

## Estado

V1.5.0 — funcional, desplegable, en producción en Cloudflare Pages. Ver
[`CHANGELOG.md`](./CHANGELOG.md) para el detalle de qué incluye, y el
historial de commits para el desarrollo por fases.
