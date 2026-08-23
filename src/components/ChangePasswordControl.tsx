import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const TOGGLE_CLASS = {
  light: 'text-neutral-500 underline hover:text-neutral-900',
  dark: 'text-neutral-400 underline hover:text-white',
}

const DIVIDER_CLASS = {
  light: 'border-neutral-100',
  dark: 'border-neutral-800',
}

export function ChangePasswordControl({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
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

  return (
    <>
      <button type="button" onClick={toggleChangePassword} className={TOGGLE_CLASS[variant]}>
        Cambiar contraseña
      </button>

      {showChangePassword && (
        <div className={`mt-3 w-full space-y-2 border-t pt-3 ${DIVIDER_CLASS[variant]}`}>
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
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              />
              <input
                type="password"
                placeholder="Confirmar contraseña"
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              />
              <button
                type="button"
                onClick={() => void handleChangePassword()}
                disabled={changingPassword}
                className="w-full rounded-md bg-brand-500 px-2 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {changingPassword ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
