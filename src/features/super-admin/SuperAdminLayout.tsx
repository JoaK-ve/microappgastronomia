import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

export function SuperAdminLayout() {
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <nav className="flex flex-col border-b border-neutral-200 bg-white print:hidden md:w-56 md:border-b-0 md:border-r">
          <div className="px-4 py-5">
            <span className="text-lg font-semibold">Super Admin</span>
            <p className="text-xs text-neutral-400">MicroApp Gastronómica</p>
          </div>
          <ul className="flex flex-row overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:px-2">
            <li>
              <NavLink
                to="/super-admin"
                end
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  }`
                }
              >
                Negocios
              </NavLink>
            </li>
          </ul>
          <div className="mt-auto border-t border-neutral-200 px-4 py-3 text-sm">
            <p className="truncate text-neutral-500">{session?.user?.email}</p>
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
