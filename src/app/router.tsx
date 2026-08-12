import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomePage } from '@/features/home/HomePage'
import { IngredientsPage } from '@/features/ingredients/IngredientsPage'
import { RecipesPage } from '@/features/recipes/RecipesPage'
import { ProductionPage } from '@/features/production/ProductionPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'ingredientes', element: <IngredientsPage /> },
      { path: 'recetas', element: <RecipesPage /> },
      { path: 'produccion', element: <ProductionPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
