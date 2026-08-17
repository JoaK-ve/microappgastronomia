import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { Business, Profile, UserRole } from '@/types'

export function SettingsPage() {
  const { profile } = useAuth()
  const [business, setBusiness] = useState<Business | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const [businessResult, usersResult] = await Promise.all([
      supabase.from('businesses').select('*').single(),
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    ])
    setBusiness((businessResult.data as Business) ?? null)
    setUsers((usersResult.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Negocio</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Nombre</dt>
            <dd>{business?.name}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Moneda</dt>
            <dd>{business?.currency}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Usuarios</h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-neutral-500">{user.email}</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                {user.role === 'admin' ? 'Administrador' : 'Cocina'}
              </span>
            </li>
          ))}
        </ul>

        {profile?.role === 'admin' && <InviteUserForm onInvited={loadData} />}
      </section>
    </div>
  )
}

function InviteUserForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('kitchen')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const { error: invokeError } = await supabase.functions.invoke('invite-user', {
      body: { email, name, role },
    })

    setLoading(false)

    if (invokeError) {
      setError('No se pudo invitar al usuario. Comprueba el email e inténtalo de nuevo.')
      return
    }

    setSuccess(`Invitación enviada a ${email}.`)
    setEmail('')
    setName('')
    setRole('kitchen')
    onInvited()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
      <h3 className="text-sm font-medium text-neutral-700">Invitar usuario</h3>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Nombre"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:flex-1"
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:flex-1"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-40"
        >
          <option value="kitchen">Cocina</option>
          <option value="admin">Administrador</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Invitando…' : 'Invitar'}
        </button>
      </div>
    </form>
  )
}
