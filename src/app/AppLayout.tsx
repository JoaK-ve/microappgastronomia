import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { SidebarShell, type NavItem as SidebarNavItem } from '@/components/SidebarShell'
import { getDaysRemaining, getEffectiveStatus, type EffectiveStatus } from '@/lib/businessLifecycle'
import {
  IconBook,
  IconCalculator,
  IconGear,
  IconHome,
  IconLeaf,
  IconPot,
  IconWheat,
} from '@/components/icons/NavIcons'
import type { Business } from '@/types'

const LOGO_BUCKET = 'logos'

type NavItem = SidebarNavItem & { adminOnly: boolean }

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', end: true, adminOnly: false, icon: IconHome },
  { to: '/ingredientes', label: 'Ingredientes', end: false, adminOnly: false, icon: IconLeaf },
  { to: '/recetas', label: 'Recetas', end: false, adminOnly: false, icon: IconBook },
  { to: '/panaderia', label: 'Panadería', end: false, adminOnly: false, icon: IconWheat },
  { to: '/escandallo', label: 'Escandallo', end: false, adminOnly: true, icon: IconCalculator },
  { to: '/produccion', label: 'Producción', end: false, adminOnly: false, icon: IconPot },
  { to: '/configuracion', label: 'Configuración', end: false, adminOnly: true, icon: IconGear },
]

// Contexto que AppLayout pasa a todas las pantallas anidadas (vía <Outlet
// context={...}>) — hoy solo lo usa Configuración, para que el logo del
// sidebar se actualice al momento tras cambiarlo, sin esperar a un F5.
export type AppLayoutContext = { refreshBusiness: () => void }

export function AppLayout() {
  const { session, profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [effectiveStatus, setEffectiveStatus] = useState<EffectiveStatus | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)

  // Importante: el valor inicial de useRef solo aplica en el montaje real,
  // nunca de nuevo — así que en modo desarrollo (React StrictMode monta,
  // desmonta y vuelve a montar para probar los efectos) el flag quedaría en
  // `false` para siempre tras el primer ciclo si solo se pusiera `true` una
  // vez. Por eso se re-arma dentro del propio efecto, que sí se vuelve a
  // ejecutar en cada (re)montaje.
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function loadBusiness(businessId: string) {
    const { data } = await supabase
      .from('businesses')
      .select('logo_url, status, trial_ends_at')
      .eq('id', businessId)
      .single()

    if (!mountedRef.current) return

    const business = data as Pick<Business, 'logo_url' | 'status' | 'trial_ends_at'> | null

    const path = business?.logo_url
    if (!path) {
      setLogoUrl(null)
    } else {
      const { data: signed } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, 3600)
      if (mountedRef.current) setLogoUrl(signed?.signedUrl ?? null)
    }

    if (business) {
      const effective = getEffectiveStatus(business)
      setEffectiveStatus(effective)
      setDaysRemaining(getDaysRemaining(business, effective))
    } else {
      setEffectiveStatus(null)
    }
  }

  useEffect(() => {
    if (!profile?.business_id) {
      setLogoUrl(null)
      setEffectiveStatus(null)
      return
    }
    void loadBusiness(profile.business_id)
  }, [profile?.business_id])

  // Expuesto vía Outlet context — Configuración lo llama tras guardar el
  // negocio, para que un logo nuevo (o quitado) se vea en el sidebar sin
  // tener que recargar la página.
  function refreshBusiness() {
    if (profile?.business_id) void loadBusiness(profile.business_id)
  }

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

  return (
    <SidebarShell
      navItems={visibleItems}
      header={
        logoUrl ? (
          <>
            <img src={logoUrl} alt="Logo del negocio" className="h-12 max-w-full object-contain md:h-16" />
            <p className="mt-1.5 truncate text-xs text-neutral-400">MicroApp Gastronómica</p>
          </>
        ) : (
          <span className="truncate text-lg font-semibold text-brand-100">MicroApp Gastronómica</span>
        )
      }
      banner={
        <>
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
        </>
      }
      footerDetail={
        <>
          <p className="hidden truncate font-medium md:block">{profile?.name}</p>
          <p className="hidden truncate text-neutral-400 md:block">{profile?.email}</p>
        </>
      }
      accountDetail={<p className="truncate px-1 pb-2 text-xs text-neutral-500">{profile?.email}</p>}
      onSignOut={() => void signOut()}
    >
      <Outlet context={{ refreshBusiness } satisfies AppLayoutContext} />
    </SidebarShell>
  )
}
