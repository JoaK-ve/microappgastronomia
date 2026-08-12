import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ingredientes', label: 'Ingredientes' },
  { to: '/recetas', label: 'Recetas' },
  { to: '/produccion', label: 'Producción' },
  { to: '/configuracion', label: 'Configuración' },
]

export function AppLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <nav className="border-b border-neutral-200 bg-white md:w-56 md:border-b-0 md:border-r">
          <div className="px-4 py-4 text-lg font-semibold">MicroApp Gastronómica</div>
          <ul className="flex flex-row overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:px-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.to} className="shrink-0">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
