import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { SuperAdminRoute } from '@/features/auth/SuperAdminRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { HomePage } from '@/features/home/HomePage'
import { IngredientsPage } from '@/features/ingredients/IngredientsPage'
import { IngredientFormPage } from '@/features/ingredients/IngredientFormPage'
import { RecipesPage } from '@/features/recipes/RecipesPage'
import { RecipeFormPage } from '@/features/recipes/RecipeFormPage'
import { RecipeViewPage } from '@/features/recipes/RecipeViewPage'
import { EscandalloPage } from '@/features/recipes/EscandalloPage'
import { ProductionPage } from '@/features/production/ProductionPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SuperAdminLayout } from '@/features/super-admin/SuperAdminLayout'
import { SuperAdminBusinessesPage } from '@/features/super-admin/SuperAdminBusinessesPage'
import { SuperAdminBusinessDetailPage } from '@/features/super-admin/SuperAdminBusinessDetailPage'

const ImportIngredientsPage = lazy(() =>
  import('@/features/ingredients/import/ImportIngredientsPage').then((m) => ({ default: m.ImportIngredientsPage })),
)

function ImportIngredientsRoute() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Cargando…</p>}>
      <ImportIngredientsPage />
    </Suspense>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/invitacion', element: <AcceptInvitePage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'ingredientes', element: <IngredientsPage /> },
          { path: 'ingredientes/nuevo', element: <IngredientFormPage /> },
          { path: 'ingredientes/importar', element: <ImportIngredientsRoute /> },
          { path: 'ingredientes/:id', element: <IngredientFormPage /> },
          { path: 'recetas', element: <RecipesPage /> },
          { path: 'recetas/nueva', element: <RecipeFormPage /> },
          { path: 'recetas/:id', element: <RecipeViewPage /> },
          { path: 'recetas/:id/editar', element: <RecipeFormPage /> },
          { path: 'escandallo', element: <EscandalloPage /> },
          { path: 'produccion', element: <ProductionPage /> },
          { path: 'configuracion', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '/super-admin',
    element: <SuperAdminRoute />,
    children: [
      {
        element: <SuperAdminLayout />,
        children: [
          { index: true, element: <SuperAdminBusinessesPage /> },
          { path: 'negocios/:id', element: <SuperAdminBusinessDetailPage /> },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
