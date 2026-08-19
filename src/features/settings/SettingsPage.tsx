import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Business, Profile, UserRole } from '@/types'

const LOGO_BUCKET = 'logos'
const MAX_LOGO_SIZE = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
        {profile?.role === 'admin' && business ? (
          <BusinessForm business={business} onSaved={loadData} />
        ) : (
          <BusinessReadOnly business={business} />
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Usuarios</h2>
        <UsersList users={users} currentUserId={profile?.id} isAdmin={profile?.role === 'admin'} onChanged={loadData} />

        {profile?.role === 'admin' && <InviteUserForm onInvited={loadData} />}
      </section>
    </div>
  )
}

function BusinessReadOnly({ business }: { business: Business | null }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!business?.logo_url) {
      setLogoUrl(null)
      return
    }
    let cancelled = false
    supabase.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(business.logo_url, 3600)
      .then(({ data }) => {
        if (!cancelled) setLogoUrl(data?.signedUrl ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [business?.logo_url])

  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-neutral-500">Nombre</dt>
        <dd>{business?.name}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">Moneda</dt>
        <dd>{business?.currency}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">Teléfono</dt>
        <dd>{business?.phone || '—'}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">Email</dt>
        <dd>{business?.email || '—'}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-neutral-500">Dirección</dt>
        <dd>{business?.address || '—'}</dd>
      </div>
      {logoUrl && (
        <div className="sm:col-span-2">
          <dt className="text-neutral-500">Logo</dt>
          <dd className="mt-1">
            <img
              src={logoUrl}
              alt="Logo del negocio"
              className="h-16 w-16 rounded-md border border-neutral-200 object-contain"
            />
          </dd>
        </div>
      )}
    </dl>
  )
}

function BusinessForm({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const [name, setName] = useState(business.name)
  const [phone, setPhone] = useState(business.phone ?? '')
  const [email, setEmail] = useState(business.email ?? '')
  const [address, setAddress] = useState(business.address ?? '')
  const [logoPath, setLogoPath] = useState(business.logo_url)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setName(business.name)
    setPhone(business.phone ?? '')
    setEmail(business.email ?? '')
    setAddress(business.address ?? '')
    setLogoPath(business.logo_url)
    setPendingLogoFile(null)
    setRemoveLogo(false)
  }, [business])

  useEffect(() => {
    if (pendingLogoFile) {
      const objectUrl = URL.createObjectURL(pendingLogoFile)
      setLogoPreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }
    if (removeLogo || !logoPath) {
      setLogoPreviewUrl(null)
      return
    }
    let cancelled = false
    supabase.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(logoPath, 3600)
      .then(({ data }) => {
        if (!cancelled) setLogoPreviewUrl(data?.signedUrl ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [pendingLogoFile, removeLogo, logoPath])

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError('El logo debe ser una imagen PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError('El logo no puede superar 2 MB.')
      return
    }

    setPendingLogoFile(file)
    setRemoveLogo(false)
  }

  function handleRemoveLogo() {
    setPendingLogoFile(null)
    setRemoveLogo(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre del negocio es obligatorio.')
      return
    }
    if (phone.trim().length > 30) {
      setError('El teléfono es demasiado largo.')
      return
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError('El email no tiene un formato válido.')
      return
    }

    setSaving(true)

    let nextLogoPath = logoPath

    if (pendingLogoFile) {
      const path = `${business.id}/logo`
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, pendingLogoFile, { upsert: true, contentType: pendingLogoFile.type })

      if (uploadError) {
        setSaving(false)
        setError('No se pudo subir el logo. Inténtalo de nuevo.')
        return
      }
      nextLogoPath = path
    } else if (removeLogo && logoPath) {
      await supabase.storage.from(LOGO_BUCKET).remove([logoPath])
      nextLogoPath = null
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        name: trimmedName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        logo_url: nextLogoPath,
      })
      .eq('id', business.id)

    setSaving(false)

    if (updateError) {
      setError('No se pudieron guardar los cambios. Inténtalo de nuevo.')
      return
    }

    setSuccess('Cambios guardados.')
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-neutral-700">
            Nombre
          </label>
          <input
            id="businessName"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="businessCurrency" className="block text-sm font-medium text-neutral-700">
            Moneda
          </label>
          <input
            id="businessCurrency"
            type="text"
            disabled
            value={business.currency}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="businessPhone" className="block text-sm font-medium text-neutral-700">
            Teléfono
          </label>
          <input
            id="businessPhone"
            type="text"
            maxLength={30}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="businessEmail" className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="businessEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="businessAddress" className="block text-sm font-medium text-neutral-700">
            Dirección
          </label>
          <input
            id="businessAddress"
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-neutral-700">Logo</span>
        <div className="mt-1 flex items-center gap-3">
          {logoPreviewUrl ? (
            <img
              src={logoPreviewUrl}
              alt="Logo del negocio"
              className="h-16 w-16 rounded-md border border-neutral-200 object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-neutral-300 text-xs text-neutral-400">
              Sin logo
            </div>
          )}
          <div className="flex flex-col items-start gap-1">
            <label className="cursor-pointer text-sm font-medium text-neutral-700 underline">
              {logoPreviewUrl ? 'Cambiar logo' : 'Subir logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
            {logoPreviewUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-sm text-red-600 hover:underline"
              >
                Eliminar logo
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-400">PNG, JPG o WEBP, máximo 2 MB.</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function UsersList({
  users,
  currentUserId,
  isAdmin,
  onChanged,
}: {
  users: Profile[]
  currentUserId: string | undefined
  isAdmin: boolean
  onChanged: () => void
}) {
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [targetUser, setTargetUser] = useState<Profile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [resetSendingId, setResetSendingId] = useState<string | null>(null)
  const [resetSentId, setResetSentId] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleResetPassword(user: Profile) {
    setResetSendingId(user.id)
    setResetSentId(null)
    setResetError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/invitacion`,
    })

    setResetSendingId(null)

    if (error) {
      setResetError(`No se pudo enviar el correo a ${user.email}.`)
      return
    }

    setResetSentId(user.id)
  }

  function handleDeleteClick(user: Profile) {
    setTargetUser(user)
    setDeleteError(null)
    setDeleteState('confirm')
  }

  async function handleDeleteConfirm() {
    if (!targetUser) return
    setDeleteState('deleting')
    setDeleteError(null)

    const { error: invokeError } = await supabase.functions.invoke('delete-user', {
      body: { userId: targetUser.id },
    })

    if (invokeError) {
      setDeleteError('No se pudo eliminar el usuario. Inténtalo de nuevo.')
      setDeleteState('confirm')
      return
    }

    setDeleteState('idle')
    setTargetUser(null)
    onChanged()
  }

  function handleDeleteCancel() {
    setDeleteState('idle')
    setTargetUser(null)
    setDeleteError(null)
  }

  return (
    <>
      <ul className="mt-3 divide-y divide-neutral-100">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-neutral-500">{user.email}</p>
              {resetSentId === user.id && <p className="text-xs text-green-700">Correo de reseteo enviado.</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                {user.role === 'admin' ? 'Administrador' : 'Cocina'}
              </span>
              {isAdmin && user.id !== currentUserId && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleResetPassword(user)}
                    disabled={resetSendingId === user.id}
                    className="text-xs font-medium text-neutral-600 hover:underline disabled:opacity-50"
                  >
                    {resetSendingId === user.id ? 'Enviando…' : 'Resetear contraseña'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(user)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {resetError && <p className="mt-2 text-xs text-red-600">{resetError}</p>}

      <ConfirmDialog
        open={deleteState === 'confirm' || deleteState === 'deleting'}
        title="Eliminar usuario"
        description={
          <p>
            ¿Quieres eliminar a &quot;{targetUser?.name}&quot; ({targetUser?.email})? Esta acción no se puede
            deshacer — perderá acceso a la aplicación de inmediato.
          </p>
        }
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={handleDeleteCancel}
        loading={deleteState === 'deleting'}
        error={deleteError}
      />
    </>
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
      body: { email, name, role, origin: window.location.origin },
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
