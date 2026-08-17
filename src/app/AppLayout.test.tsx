import { render, screen } from '@testing-library/react'
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

describe('AppLayout', () => {
  it('muestra la navegación principal sin sesión iniciada', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ingredientes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recetas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Producción' })).toBeInTheDocument()
  })

  it('oculta Configuración cuando no hay perfil de administrador', () => {
    renderLayout()

    expect(screen.queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument()
  })
})
