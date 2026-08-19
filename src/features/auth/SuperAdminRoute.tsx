import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'

export function SuperAdminRoute() {
  const { session, profile, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    if (!session) {
      setChecking(false)
      return
    }
    let cancelled = false
    supabase.rpc('is_super_admin').then(({ data }) => {
      if (!cancelled) {
        setIsSuperAdmin(data === true)
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [session])

  if (authLoading || checking) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-500">Cargando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // La protección real está en el backend (is_super_admin() + RLS de
  // platform_admins, sin políticas): esto solo evita que un usuario normal
  // vea la pantalla, aunque llegue por URL directa.
  if (!isSuperAdmin) {
    // Un usuario con perfil de negocio va a su Inicio normal. Uno sin
    // perfil Y sin ser Super Admin es un estado que no debería existir
    // (todo alta real crea un perfil) — evitamos aquí mismo cualquier
    // posibilidad de bucle con la redirección de AppLayout hacia acá.
    if (!profile) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 text-center text-neutral-500">
          Esta cuenta no tiene acceso a ninguna pantalla. Contacta al administrador de la plataforma.
        </div>
      )
    }
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
