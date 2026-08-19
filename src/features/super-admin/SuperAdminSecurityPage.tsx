import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordControl } from '@/components/ChangePasswordControl'

export function SuperAdminSecurityPage() {
  const { session } = useAuth()

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Mi seguridad</h1>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Cuenta</h2>
        <p className="mt-1 text-sm text-neutral-500">{session?.user?.email}</p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Contraseña</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Cambia tu contraseña aquí mismo. Si no tienes sesión iniciada y no la recuerdas, usa "¿Olvidaste tu
          contraseña?" en la pantalla de inicio de sesión.
        </p>
        <div className="mt-3">
          <ChangePasswordControl />
        </div>
      </section>
    </div>
  )
}
