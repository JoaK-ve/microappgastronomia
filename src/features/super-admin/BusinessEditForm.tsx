import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { Business } from '@/types'

const LOGO_BUCKET = 'logos'
const MAX_LOGO_SIZE = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function BusinessEditForm({ business, onSaved }: { business: Business; onSaved: () => void }) {
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

    // Camino de autorización propio del Super Admin (RPC dedicada), no la
    // policy de auto-edición del admin normal del negocio.
    const { error: updateError } = await supabase.rpc('super_admin_update_business_profile', {
      p_business_id: business.id,
      p_name: trimmedName,
      p_phone: phone.trim() || null,
      p_email: email.trim() || null,
      p_address: address.trim() || null,
      p_logo_url: nextLogoPath,
    })

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
          <label htmlFor="saBusinessName" className="block text-sm font-medium text-neutral-700">
            Nombre
          </label>
          <input
            id="saBusinessName"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="saBusinessPhone" className="block text-sm font-medium text-neutral-700">
            Teléfono
          </label>
          <input
            id="saBusinessPhone"
            type="text"
            maxLength={30}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="saBusinessEmail" className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="saBusinessEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="saBusinessAddress" className="block text-sm font-medium text-neutral-700">
            Dirección
          </label>
          <input
            id="saBusinessAddress"
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
              <button type="button" onClick={handleRemoveLogo} className="text-sm text-red-600 hover:underline">
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
