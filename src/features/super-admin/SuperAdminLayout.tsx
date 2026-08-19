import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordControl } from '@/components/ChangePasswordControl'

const NAV_ITEMS = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/negocios', label: 'Negocios', end: false },
  { to: '/super-admin/usuarios', label: 'Usuarios', end: false },
  { to: '/super-admin/auditoria', label: 'Auditoría', end: false },
  { to: '/super-admin/seguridad', label: 'Mi seguridad', end: false },
]

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
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-neutral-200 px-4 py-3 text-sm">
            <p className="truncate text-neutral-500">{session?.user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <ChangePasswordControl />
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-neutral-500 underline hover:text-neutral-900"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </nav>
        <main className="flex-1 p-4 print:p-0 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
