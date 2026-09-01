import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordControl } from '@/components/ChangePasswordControl'
import { APP_VERSION_DISPLAY } from '@/lib/version'
import { IconBriefcase, IconClipboard, IconHome, IconShield, IconUser } from '@/components/icons/NavIcons'

type NavItem = {
  to: string
  label: string
  end: boolean
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const NAV_ITEMS: NavItem[] = [
  { to: '/super-admin', label: 'Dashboard', end: true, icon: IconHome },
  { to: '/super-admin/negocios', label: 'Negocios', end: false, icon: IconBriefcase },
  { to: '/super-admin/usuarios', label: 'Usuarios', end: false, icon: IconUser },
  { to: '/super-admin/auditoria', label: 'Auditoría', end: false, icon: IconClipboard },
  { to: '/super-admin/seguridad', label: 'Mi seguridad', end: false, icon: IconShield },
]

const DESKTOP_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-500 text-white' : 'text-neutral-300 hover:bg-neutral-800'
  }`

const MOBILE_TAB_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex w-16 shrink-0 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
    isActive ? 'text-brand-400' : 'text-neutral-400'
  }`

export function SuperAdminLayout() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    setAccountOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <nav
          aria-label="Navegación principal"
          className="flex flex-col border-b border-neutral-800 bg-neutral-900 text-neutral-50 print:hidden md:w-56 md:border-b-0 md:border-r"
        >
          <div className="px-4 py-3 md:py-5">
            <span className="truncate text-lg font-semibold text-brand-100">OídoChef</span>
            <p className="mt-1.5 truncate text-xs text-neutral-400">Panel de Super Admin</p>
          </div>

          {/* Navegación completa: solo escritorio. En móvil vive en la barra inferior. */}
          <ul className="hidden flex-col gap-0.5 px-2 md:flex">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={DESKTOP_LINK_CLASS}>
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-auto border-t border-neutral-800 px-4 py-3 text-sm">
            <p className="hidden truncate text-neutral-400 md:block">{session?.user?.email}</p>
            <div className="flex flex-wrap gap-3 md:mt-2">
              <ChangePasswordControl variant="dark" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-neutral-400 underline hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
          <p className="hidden border-t border-neutral-800 px-4 py-2 text-right text-xs text-neutral-500 md:block">
            {APP_VERSION_DISPLAY}
          </p>
        </nav>

        <main className="flex-1 p-4 pb-24 print:p-0 md:p-8 md:pb-8">
          <Outlet />
        </main>

        {/* Barra inferior: solo móvil/tablet estrecho, igual patrón que la app principal. */}
        <nav
          aria-label="Navegación móvil"
          className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-neutral-800 bg-neutral-900 pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={MOBILE_TAB_CLASS}>
              <item.icon className="h-5.5 w-5.5" />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setAccountOpen((v) => !v)}
            className={`flex w-16 shrink-0 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              accountOpen ? 'text-brand-400' : 'text-neutral-400'
            }`}
          >
            <IconUser className="h-5.5 w-5.5" />
            Cuenta
          </button>
        </nav>

        {accountOpen && (
          <div
            role="presentation"
            className="fixed inset-0 z-30 bg-neutral-900/40 md:hidden"
            onClick={() => setAccountOpen(false)}
          >
            <div
              className="absolute inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] rounded-t-xl border-t border-neutral-200 bg-white p-3 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="truncate px-1 pb-2 text-xs text-neutral-500">{session?.user?.email}</p>
              <div className="border-t border-neutral-100 px-1 py-2.5 text-sm text-neutral-700">
                <ChangePasswordControl />
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full rounded-md px-1 py-2.5 text-left text-sm font-medium text-red-600"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
