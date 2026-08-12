# MicroApp Gastronómica V1

Recetario + Escandallo + Fichas Técnicas + Hoja de Producción para chefs,
cocineros y pequeños negocios gastronómicos.

Especificación funcional: Documento Maestro — MicroApp Gastronómica V0.4.

## Stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS v4, React Router.
- **Backend/datos:** Supabase (Postgres, Auth, Row Level Security). El motor
  de costes vive en Postgres (funciones SQL), no en el cliente.
- **Hosting:** Cloudflare Pages.
- **Tests:** Vitest + Testing Library.

## Estructura del proyecto

```
src/
  app/              # layout y rutas
  features/         # una carpeta por sección de negocio
    home/
    ingredients/
    recipes/
    production/
    settings/
  components/       # UI reutilizable entre features
  lib/
    supabase.ts     # cliente Supabase
  types/            # tipos compartidos
  test/             # setup de Vitest
supabase/
  migrations/       # esquema SQL versionado
  seed/             # datos de demostración (DEMO — no usar en producción)
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

Salida en `dist/`, desplegable en Cloudflare Pages (`wrangler.jsonc` ya
apunta a ese directorio).

## Estado

En desarrollo por fases. Ver progreso en el historial de commits.
