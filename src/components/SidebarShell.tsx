import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChangePasswordControl } from '@/components/ChangePasswordControl'
import { APP_VERSION_DISPLAY } from '@/lib/version'
import { IconUser } from '@/components/icons/NavIcons'

// El esqueleto del sidebar (escritorio) + barra inferior (móvil) + panel de
// "Cuenta" — compartido entre la app principal y el panel de Super Admin,
// que antes tenían el mismo JSX copiado dos veces (hallazgo de la
// auditoría). Lo que SÍ difiere entre los dos — el encabezado (logo vs.
// texto fijo), el banner de prueba/gracia (solo la app principal lo tiene),
// y qué se muestra en el pie (nombre+email vs. solo email) — se queda fuera
// de este componente, como slots que cada layout llena a su manera.

export type NavItem = {
  to: string
  label: string
  end: boolean
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const DESKTOP_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-500 text-white' : 'text-neutral-300 hover:bg-neutral-800'
  }`

const MOBILE_TAB_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex w-16 shrink-0 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
    isActive ? 'text-brand-400' : 'text-neutral-400'
  }`

export function SidebarShell({
  navItems,
  header,
  banner,
  footerDetail,
  accountDetail,
  onSignOut,
  children,
}: {
  navItems: NavItem[]
  header: ReactNode
  banner?: ReactNode
  footerDetail?: ReactNode
  accountDetail?: ReactNode
  onSignOut: () => void
  children: ReactNode
}) {
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
          <div className="px-4 py-3 md:py-5">{header}</div>

          {banner}

          {/* Navegación completa: solo escritorio. En móvil vive en la barra inferior. */}
          <ul className="hidden flex-col gap-0.5 px-2 md:flex">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={DESKTOP_LINK_CLASS}>
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-auto border-t border-neutral-800 px-4 py-3 text-sm">
            {footerDetail}
            <div className="flex flex-wrap gap-3 md:mt-2">
              <ChangePasswordControl variant="dark" />
              <button type="button" onClick={onSignOut} className="text-neutral-400 underline hover:text-white">
                Cerrar sesión
              </button>
            </div>
          </div>
          <p className="hidden border-t border-neutral-800 px-4 py-2 text-right text-xs text-neutral-500 md:block">
            {APP_VERSION_DISPLAY}
          </p>
        </nav>

        <main className="flex-1 p-4 pb-24 print:p-0 md:p-8 md:pb-8">{children}</main>

        {/* Barra inferior: solo móvil/tablet estrecho. Todos los iconos
            caben deslizando de lado (igual que la fila de arriba que
            reemplaza) — nada se agrupa bajo un menú. */}
        <nav
          aria-label="Navegación móvil"
          className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-neutral-800 bg-neutral-900 pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
        >
          {navItems.map((item) => (
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
              {accountDetail}
              <div className="border-t border-neutral-100 px-1 py-2.5 text-sm text-neutral-700">
                <ChangePasswordControl />
              </div>
              <button
                type="button"
                onClick={onSignOut}
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
