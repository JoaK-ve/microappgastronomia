import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getEffectiveStatus, type EffectiveStatus } from '@/lib/businessLifecycle'
import type { Business } from '@/types'

type Action = 'activate' | 'suspend' | 'renew'

const ACTIONS_BY_STATUS: Record<EffectiveStatus, Action[]> = {
  trial: ['activate', 'suspend', 'renew'],
  grace: ['activate', 'suspend', 'renew'],
  active: ['suspend'],
  suspended: ['activate', 'renew'],
}

const ACTION_LABEL: Record<Action, string> = {
  activate: 'Activar',
  suspend: 'Suspender',
  renew: 'Renovar trial',
}

const ACTION_RPC: Record<Action, string> = {
  activate: 'super_admin_activate_business',
  suspend: 'super_admin_suspend_business',
  renew: 'super_admin_renew_trial',
}

const ACTION_DESCRIPTION: Record<Action, string> = {
  activate: 'Quedará operativo indefinidamente, sin fecha de vencimiento, hasta que decidas suspenderlo.',
  suspend: 'Los usuarios perderán el acceso operativo a OídoChef, pero todos sus datos se conservarán.',
  renew: 'Se concederán 14 días nuevos a partir de ahora, sin acumular tiempo del ciclo anterior.',
}

export function BusinessLifecycleActions({
  business,
  onChanged,
  compact = false,
}: {
  business: Business
  onChanged: () => void
  compact?: boolean
}) {
  const effective = getEffectiveStatus(business)
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!pendingAction) return
    setLoading(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc(ACTION_RPC[pendingAction], { p_business_id: business.id })

    setLoading(false)

    if (rpcError) {
      setError('No se pudo completar la acción. Inténtalo de nuevo.')
      return
    }

    setPendingAction(null)
    onChanged()
  }

  function handleCancel() {
    setPendingAction(null)
    setError(null)
  }

  const buttonClass = compact
    ? 'text-xs font-medium text-neutral-600 hover:underline'
    : 'rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100'

  return (
    <>
      <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-2'}>
        {ACTIONS_BY_STATUS[effective].map((action) => (
          <button key={action} type="button" onClick={() => setPendingAction(action)} className={buttonClass}>
            {ACTION_LABEL[action]}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? ACTION_LABEL[pendingAction] : ''}
        description={
          <p>
            ¿Seguro que quieres {pendingAction ? ACTION_LABEL[pendingAction].toLowerCase() : ''} el negocio &quot;
            {business.name}&quot;? {pendingAction ? ACTION_DESCRIPTION[pendingAction] : ''}
          </p>
        }
        confirmLabel={pendingAction ? ACTION_LABEL[pendingAction] : 'Confirmar'}
        loadingLabel="Aplicando…"
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancel}
        loading={loading}
        error={error}
      />
    </>
  )
}
