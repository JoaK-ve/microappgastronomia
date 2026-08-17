import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', end: true, adminOnly: false },
  { to: '/ingredientes', label: 'Ingredientes', end: false, adminOnly: false },
  { to: '/recetas', label: 'Recetas', end: false, adminOnly: false },
  { to: '/produccion', label: 'Producción', end: false, adminOnly: false },
  { to: '/configuracion', label: 'Configuración', end: false, adminOnly: true },
]

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <nav className="flex flex-col border-b border-neutral-200 bg-white print:hidden md:w-56 md:border-b-0 md:border-r">
          <div className="px-4 py-4 text-lg font-semibold">MicroApp Gastronómica</div>
          <ul className="flex flex-row overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:px-2">
            {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
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
          <div className="mt-auto border-t border-neutral-200 px-4 py-3 text-sm">
            <p className="truncate font-medium">{profile?.name}</p>
            <p className="truncate text-neutral-500">{profile?.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 text-neutral-500 underline hover:text-neutral-900"
            >
              Cerrar sesión
            </button>
          </div>
        </nav>
        <main className="flex-1 p-4 print:p-0 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
