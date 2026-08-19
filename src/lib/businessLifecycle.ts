import type { Business, BusinessStatus } from '@/types'

// GRACE nunca se guarda en la base — se calcula aquí mismo, en el
// frontend, con exactamente la misma regla que la función SQL
// business_is_operational(): coherencia entre lo que ve el usuario y lo
// que realmente bloquea/permite el backend.
export type EffectiveStatus = 'trial' | 'grace' | 'active' | 'suspended'

const GRACE_DAYS = 7

export function getEffectiveStatus(business: Pick<Business, 'status' | 'trial_ends_at'>): EffectiveStatus {
  if (business.status === 'suspended') return 'suspended'
  if (business.status === 'active') return 'active'

  // status === 'trial' (o el 'expired' sin usar de SA-1, tratado igual que trial)
  if (!business.trial_ends_at) return 'suspended'

  const trialEnds = new Date(business.trial_ends_at).getTime()
  const graceEnds = trialEnds + GRACE_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()

  if (now <= trialEnds) return 'trial'
  if (now <= graceEnds) return 'grace'
  return 'suspended'
}

export function getDaysRemaining(business: Pick<Business, 'trial_ends_at'>, effective: EffectiveStatus): number {
  if (!business.trial_ends_at) return 0
  const trialEnds = new Date(business.trial_ends_at).getTime()
  const target = effective === 'grace' ? trialEnds + GRACE_DAYS * 24 * 60 * 60 * 1000 : trialEnds
  return Math.max(0, Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000)))
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  trial: 'Trial',
  grace: 'Grace',
  active: 'Active',
  suspended: 'Suspended',
}

export const STORED_STATUS_LABEL: Record<BusinessStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  expired: 'Expired',
  suspended: 'Suspended',
}
