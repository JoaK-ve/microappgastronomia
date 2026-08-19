import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordControl } from '@/components/ChangePasswordControl'
import { APP_VERSION_DISPLAY } from '@/lib/version'

const LOGO_BUCKET = 'logos'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', end: true, adminOnly: false },
  { to: '/ingredientes', label: 'Ingredientes', end: false, adminOnly: false },
  { to: '/recetas', label: 'Recetas', end: false, adminOnly: false },
  { to: '/escandallo', label: 'Escandallo', end: false, adminOnly: true },
  { to: '/produccion', label: 'Producción', end: false, adminOnly: false },
  { to: '/configuracion', label: 'Configuración', end: false, adminOnly: true },
]

export function AppLayout() {
  const { session, profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!profile?.business_id) {
      setLogoUrl(null)
      setTrialDaysLeft(null)
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

        const business = data as { logo_url: string | null; status: string; trial_ends_at: string | null } | null

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

        if (business?.status === 'trial' && business.trial_ends_at) {
          const msLeft = new Date(business.trial_ends_at).getTime() - Date.now()
          setTrialDaysLeft(Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))))
        } else {
          setTrialDaysLeft(null)
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

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <nav className="flex flex-col border-b border-neutral-200 bg-white print:hidden md:w-56 md:border-b-0 md:border-r">
          <div className="px-4 py-5">
            {logoUrl ? (
              <>
                <img src={logoUrl} alt="Logo del negocio" className="h-16 max-w-full object-contain" />
                <p className="mt-1.5 truncate text-xs text-neutral-400">MicroApp Gastronómica</p>
              </>
            ) : (
              <span className="truncate text-lg font-semibold">MicroApp Gastronómica</span>
            )}
          </div>

          {trialDaysLeft != null && (
            <div className="mx-4 mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
              🟢 Prueba gratuita
              <br />
              Te quedan {trialDaysLeft} día{trialDaysLeft === 1 ? '' : 's'}
            </div>
          )}

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
          <p className="border-t border-neutral-200 px-4 py-2 text-right text-xs text-neutral-400">
            {APP_VERSION_DISPLAY}
          </p>
        </nav>
        <main className="flex-1 p-4 print:p-0 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
