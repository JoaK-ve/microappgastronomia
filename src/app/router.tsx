import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { HomePage } from '@/features/home/HomePage'
import { IngredientsPage } from '@/features/ingredients/IngredientsPage'
import { IngredientFormPage } from '@/features/ingredients/IngredientFormPage'
import { RecipesPage } from '@/features/recipes/RecipesPage'
import { ProductionPage } from '@/features/production/ProductionPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
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
          { path: 'ingredientes/:id', element: <IngredientFormPage /> },
          { path: 'recetas', element: <RecipesPage /> },
          { path: 'produccion', element: <ProductionPage /> },
          { path: 'configuracion', element: <SettingsPage /> },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
