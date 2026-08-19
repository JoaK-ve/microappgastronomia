import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
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
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  async function handleChangePassword() {
    setPasswordError(null)

    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)

    if (error) {
      setPasswordError('No se pudo cambiar la contraseña. Inténtalo de nuevo.')
      return
    }

    setPasswordSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
  }

  function toggleChangePassword() {
    setShowChangePassword((prev) => !prev)
    setPasswordError(null)
    setPasswordSuccess(false)
    setNewPassword('')
    setConfirmPassword('')
  }

  useEffect(() => {
    if (!profile?.business_id) {
      setLogoUrl(null)
      return
    }

    let cancelled = false

    supabase
      .from('businesses')
      .select('logo_url')
      .eq('id', profile.business_id)
      .single()
      .then(({ data }) => {
        const path = (data as { logo_url: string | null } | null)?.logo_url
        if (!path) {
          if (!cancelled) setLogoUrl(null)
          return
        }
        supabase.storage
          .from(LOGO_BUCKET)
          .createSignedUrl(path, 3600)
          .then(({ data: signed }) => {
            if (!cancelled) setLogoUrl(signed?.signedUrl ?? null)
          })
      })

    return () => {
      cancelled = true
    }
  }, [profile?.business_id])

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
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={toggleChangePassword}
                className="text-neutral-500 underline hover:text-neutral-900"
              >
                Cambiar contraseña
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-neutral-500 underline hover:text-neutral-900"
              >
                Cerrar sesión
              </button>
            </div>

            {showChangePassword && (
              <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                {passwordSuccess ? (
                  <p className="text-green-700">Contraseña actualizada.</p>
                ) : (
                  <>
                    {passwordError && <p className="text-red-600">{passwordError}</p>}
                    <input
                      type="password"
                      placeholder="Contraseña nueva"
                      minLength={8}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="password"
                      placeholder="Confirmar contraseña"
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleChangePassword()}
                      disabled={changingPassword}
                      className="w-full rounded-md bg-neutral-900 px-2 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {changingPassword ? 'Guardando…' : 'Guardar'}
                    </button>
                  </>
                )}
              </div>
            )}
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
