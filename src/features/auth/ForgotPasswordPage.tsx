import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)

    // No se distingue el resultado según si el email existe o a qué rol
    // pertenece (admin, cocina o Super Admin) — es el propio comportamiento
    // de Supabase Auth, evita que este formulario sirva para averiguar si
    // una cuenta existe. Por eso siempre se muestra el mismo mensaje.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/invitacion`,
    })

    setLoading(false)
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Recuperar acceso</h1>

        {sent ? (
          <p className="text-sm text-neutral-600">
            Si <strong>{email}</strong> tiene una cuenta, recibirás un correo con un enlace para establecer una
            contraseña nueva.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-neutral-600">
              Escribe tu email y te enviaremos un enlace para establecer una contraseña nueva.
            </p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-500">
          <Link to="/login" className="font-medium text-neutral-900 underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
