import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppLayout } from '@/app/AppLayout'
import { AuthProvider } from '@/features/auth/AuthContext'

function renderLayout() {
  const router = createMemoryRouter(
    [{ path: '/', element: <AppLayout />, children: [{ index: true, element: <div>contenido</div> }] }],
    { initialEntries: ['/'] },
  )
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

// La navegación existe dos veces en el DOM (escritorio y barra móvil,
// alternadas por CSS/media query) — jsdom no evalúa media queries, así
// que hay que acotar las consultas a la nav de escritorio por su nombre
// accesible para no encontrar coincidencias duplicadas.
function desktopNav() {
  return within(screen.getByRole('navigation', { name: 'Navegación principal' }))
}

describe('AppLayout', () => {
  it('muestra la navegación principal sin sesión iniciada', () => {
    renderLayout()

    const nav = desktopNav()
    expect(nav.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Ingredientes' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Recetas' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Producción' })).toBeInTheDocument()
  })

  it('oculta Configuración cuando no hay perfil de administrador', () => {
    renderLayout()

    expect(desktopNav().queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument()
  })
})
