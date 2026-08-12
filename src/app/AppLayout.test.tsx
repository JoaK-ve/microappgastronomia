import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppLayout } from '@/app/AppLayout'

function renderLayout() {
  const router = createMemoryRouter(
    [{ path: '/', element: <AppLayout />, children: [{ index: true, element: <div>contenido</div> }] }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AppLayout', () => {
  it('muestra la navegación principal con las 5 secciones', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ingredientes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recetas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Producción' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument()
  })
})
