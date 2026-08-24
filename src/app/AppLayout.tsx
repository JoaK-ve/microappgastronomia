import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordControl } from '@/components/ChangePasswordControl'
import { APP_VERSION_DISPLAY } from '@/lib/version'
import { getDaysRemaining, getEffectiveStatus, type EffectiveStatus } from '@/lib/businessLifecycle'
import { IconBook, IconCalculator, IconGear, IconHome, IconLeaf, IconMore, IconPot } from '@/components/icons/NavIcons'
import type { Business } from '@/types'

const LOGO_BUCKET = 'logos'

type NavItem = {
  to: string
  label: string
  end: boolean
  adminOnly: boolean
  icon: ComponentType<SVGProps<SVGSVGElement>>
  mobilePrimary: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', end: true, adminOnly: false, icon: IconHome, mobilePrimary: true },
  { to: '/ingredientes', label: 'Ingredientes', end: false, adminOnly: false, icon: IconLeaf, mobilePrimary: true },
  { to: '/recetas', label: 'Recetas', end: false, adminOnly: false, icon: IconBook, mobilePrimary: true },
  { to: '/escandallo', label: 'Escandallo', end: false, adminOnly: true, icon: IconCalculator, mobilePrimary: false },
  { to: '/produccion', label: 'Producción', end: false, adminOnly: false, icon: IconPot, mobilePrimary: true },
  { to: '/configuracion', label: 'Configuración', end: false, adminOnly: true, icon: IconGear, mobilePrimary: false },
]

const DESKTOP_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-500 text-white' : 'text-neutral-300 hover:bg-neutral-800'
  }`

const MOBILE_TAB_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
    isActive ? 'text-brand-400' : 'text-neutral-400'
  }`

export function AppLayout() {
  const { session, profile, signOut } = useAuth()
  const location = useLocation()
  const isAdmin = profile?.role === 'admin'
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [effectiveStatus, setEffectiveStatus] = useState<EffectiveStatus | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!profile?.business_id) {
      setLogoUrl(null)
      setEffectiveStatus(null)
      return
    }

    let cancelled = false

    supabase
      .from('businesses')
      .select('logo_url, status, trial_ends_at')
      .eq('id', profile.business_id)
      .single()
      .then(({ data }) => {
        if (cancelled) return

        const business = data as Pick<Business, 'logo_url' | 'status' | 'trial_ends_at'> | null

        const path = business?.logo_url
        if (!path) {
          setLogoUrl(null)
        } else {
          supabase.storage
            .from(LOGO_BUCKET)
            .createSignedUrl(path, 3600)
            .then(({ data: signed }) => {
              if (!cancelled) setLogoUrl(signed?.signedUrl ?? null)
            })
        }

        if (business) {
          const effective = getEffectiveStatus(business)
          setEffectiveStatus(effective)
          setDaysRemaining(getDaysRemaining(business, effective))
        } else {
          setEffectiveStatus(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile?.business_id])

  // Un usuario AUTENTICADO sin perfil de negocio es (o debería ser) un
  // Super Admin puro — nunca se le asigna un negocio automáticamente. En
  // vez de renderizar este sidebar orientado a negocio (a medio llenar,
  // roto), lo mandamos a su panel. SuperAdminRoute valida de verdad si lo
  // es; si no lo es tampoco, ahí lo regresa aquí y no hay bucle real.
  // (El chequeo de "session &&" es a propósito: sin sesión, este mismo
  // componente se sigue usando de forma aislada en AppLayout.test.tsx.)
  if (session && !profile) {
    return <Navigate to="/super-admin" replace />
  }

  // Bloqueo real de acceso operativo: además de esto, el backend (RLS +
  // business_is_operational()) ya rechaza cualquier escritura aunque se
  // llame directo a la API — esta pantalla es solo la experiencia visible,
  // no la protección de verdad.
  if (effectiveStatus === 'suspended') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-2 text-xl font-semibold">Cuenta suspendida</h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-600">
          Tu periodo de prueba y periodo de gracia han terminado. Contacta con OídoChef para activar nuevamente tu
          cuenta.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 text-sm text-neutral-500 underline hover:text-neutral-900"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const primaryItems = visibleItems.filter((item) => item.mobilePrimary)
  const moreItems = visibleItems.filter((item) => !item.mobilePrimary)
  const hasMoreItems = moreItems.length > 0

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <nav
          aria-label="Navegación principal"
          className="flex flex-col border-b border-neutral-800 bg-neutral-900 text-neutral-50 print:hidden md:w-56 md:border-b-0 md:border-r"
        >
          <div className="px-4 py-3 md:py-5">
            {logoUrl ? (
              <>
                <img src={logoUrl} alt="Logo del negocio" className="h-12 max-w-full object-contain md:h-16" />
                <p className="mt-1.5 truncate text-xs text-neutral-400">MicroApp Gastronómica</p>
              </>
            ) : (
              <span className="truncate text-lg font-semibold text-brand-100">MicroApp Gastronómica</span>
            )}
          </div>

          {effectiveStatus === 'trial' && (
            <div className="mx-4 mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
              🟢 Prueba gratuita
              <br />
              Te quedan {daysRemaining} día{daysRemaining === 1 ? '' : 's'}
            </div>
          )}

          {effectiveStatus === 'grace' && (
            <div className="mx-4 mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ Periodo de prueba terminado
              <br />
              Te quedan {daysRemaining} día{daysRemaining === 1 ? '' : 's'} de gracia. Contacta con OídoChef para
              continuar utilizando la plataforma.
            </div>
          )}

          {/* Navegación completa: solo escritorio. En móvil vive en la barra inferior. */}
          <ul className="hidden flex-col gap-0.5 px-2 md:flex">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={DESKTOP_LINK_CLASS}>
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-auto border-t border-neutral-800 px-4 py-3 text-sm">
            <p className="hidden truncate font-medium md:block">{profile?.name}</p>
            <p className="hidden truncate text-neutral-400 md:block">{profile?.email}</p>
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

        {/* Barra inferior: solo móvil/tablet estrecho. */}
        <nav
          aria-label="Navegación móvil"
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-800 bg-neutral-900 pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
        >
          {primaryItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={MOBILE_TAB_CLASS}>
              <item.icon className="h-5.5 w-5.5" />
              {item.label}
            </NavLink>
          ))}
          {hasMoreItems && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                moreOpen ? 'text-brand-400' : 'text-neutral-400'
              }`}
            >
              <IconMore className="h-5.5 w-5.5" />
              Más
            </button>
          )}
        </nav>

        {moreOpen && (
          <div
            role="presentation"
            className="fixed inset-0 z-30 bg-neutral-900/40 md:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="absolute inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] rounded-t-xl border-t border-neutral-200 bg-white p-2 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              {moreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-neutral-700'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-1 border-t border-neutral-100 px-3 py-2.5 text-sm text-neutral-700">
                <ChangePasswordControl />
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-red-600"
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
