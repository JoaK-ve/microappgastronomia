import { useEffect, useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Profile, UserRole } from '@/types'

async function readFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  try {
    const body = await error.context.json()
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

export function BusinessUsersSection({ businessId }: { businessId: string }) {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadUsers()
  }, [businessId])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }

  const adminCount = users.filter((u) => u.role === 'admin').length
  const primaryAdmin = users.find((u) => u.role === 'admin') ?? null

  if (loading) {
    return <p className="text-neutral-500">Cargando usuarios…</p>
  }

  return (
    <div className="space-y-4">
      {primaryAdmin && (
        <p className="text-sm text-neutral-500">
          Administrador principal: <strong>{primaryAdmin.name}</strong> ({primaryAdmin.email})
        </p>
      )}

      <UsersTable users={users} adminCount={adminCount} onChanged={loadUsers} />
      <InviteUserForm businessId={businessId} onInvited={loadUsers} />
    </div>
  )
}

function UsersTable({
  users,
  adminCount,
  onChanged,
}: {
  users: Profile[]
  adminCount: number
  onChanged: () => void
}) {
  const [roleTarget, setRoleTarget] = useState<{ user: Profile; nextRole: UserRole } | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [recoverySendingId, setRecoverySendingId] = useState<string | null>(null)
  const [recoverySentId, setRecoverySentId] = useState<string | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  function isOnlyAdmin(user: Profile) {
    return user.role === 'admin' && adminCount <= 1
  }

  async function handleRoleConfirm() {
    if (!roleTarget) return
    setRoleLoading(true)
    setRoleError(null)

    const { error } = await supabase.rpc('super_admin_set_user_role', {
      p_user_id: roleTarget.user.id,
      p_role: roleTarget.nextRole,
    })

    setRoleLoading(false)

    if (error) {
      // El backend es quien realmente decide (protección de "último admin"
      // aprobada explícitamente) — este mensaje puede llegar aunque la UI
      // no lo haya anticipado.
      setRoleError(error.message)
      return
    }

    setRoleTarget(null)
    onChanged()
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)

    const { error: invokeError } = await supabase.functions.invoke('delete-user', {
      body: { userId: deleteTarget.id },
    })

    setDeleteLoading(false)

    if (invokeError) {
      // FunctionsHttpError no trae el mensaje real en .message — hay que
      // leerlo del cuerpo de la respuesta (p. ej. la protección de
      // "último admin" del backend).
      const backendMessage = await readFunctionErrorMessage(invokeError)
      setDeleteError(backendMessage ?? 'No se pudo eliminar el usuario. Inténtalo de nuevo.')
      return
    }

    setDeleteTarget(null)
    onChanged()
  }

  async function handleSendRecovery(user: Profile) {
    setRecoverySendingId(user.id)
    setRecoverySentId(null)
    setRecoveryError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/invitacion`,
    })

    if (error) {
      setRecoverySendingId(null)
      setRecoveryError(`No se pudo enviar el correo a ${user.email}.`)
      return
    }

    await supabase.rpc('super_admin_log_action', {
      p_action: 'access_recovery_sent',
      p_business_id: user.business_id,
      p_target_user_id: user.id,
      p_detail: { email: user.email },
    })

    setRecoverySendingId(null)
    setRecoverySentId(user.id)
  }

  return (
    <>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-neutral-500">{user.email}</p>
              {recoverySentId === user.id && <p className="text-xs text-green-700">Correo de recuperación enviado.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={user.role}
                onChange={(event) => {
                  const nextRole = event.target.value as UserRole
                  if (nextRole === user.role) return
                  setRoleError(null)
                  setRoleTarget({ user, nextRole })
                }}
                disabled={isOnlyAdmin(user)}
                title={isOnlyAdmin(user) ? 'Es el único administrador del negocio.' : undefined}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
              >
                <option value="admin">Administrador</option>
                <option value="kitchen">Cocina</option>
              </select>
              <button
                type="button"
                onClick={() => void handleSendRecovery(user)}
                disabled={recoverySendingId === user.id}
                className="text-xs font-medium text-neutral-600 hover:underline disabled:opacity-50"
              >
                {recoverySendingId === user.id ? 'Enviando…' : 'Enviar recuperación de acceso'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteTarget(user)
                }}
                disabled={isOnlyAdmin(user)}
                title={isOnlyAdmin(user) ? 'Es el único administrador del negocio.' : undefined}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {users.length === 0 && <li className="p-4 text-center text-sm text-neutral-400">Sin usuarios.</li>}
      </ul>
      {recoveryError && <p className="text-xs text-red-600">{recoveryError}</p>}

      <ConfirmDialog
        open={roleTarget !== null}
        title="Cambiar rol"
        description={
          <p>
            ¿Cambiar el rol de &quot;{roleTarget?.user.name}&quot; a{' '}
            {roleTarget?.nextRole === 'admin' ? 'Administrador' : 'Cocina'}?
          </p>
        }
        onConfirm={() => void handleRoleConfirm()}
        onCancel={() => {
          setRoleTarget(null)
          setRoleError(null)
        }}
        loading={roleLoading}
        error={roleError}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar usuario"
        description={
          <p>
            ¿Quieres eliminar a &quot;{deleteTarget?.name}&quot; ({deleteTarget?.email})? Esta acción no se puede
            deshacer.
          </p>
        }
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
        loading={deleteLoading}
        error={deleteError}
      />
    </>
  )
}

function InviteUserForm({ businessId, onInvited }: { businessId: string; onInvited: () => void }) {
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
      body: { email, name, role, origin: window.location.origin, business_id: businessId },
    })

    setLoading(false)

    if (invokeError) {
      const backendMessage = await readFunctionErrorMessage(invokeError)
      setError(backendMessage ?? 'No se pudo invitar al usuario. Comprueba el email e inténtalo de nuevo.')
      return
    }

    setSuccess(`Invitación enviada a ${email}.`)
    setEmail('')
    setName('')
    setRole('kitchen')
    onInvited()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-medium text-neutral-700">Invitar usuario a este negocio</h3>

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
