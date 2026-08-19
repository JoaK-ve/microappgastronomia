import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { BusinessLifecycleActions } from '@/components/BusinessLifecycleActions'
import { getEffectiveStatus, getDaysRemaining, STATUS_LABEL, type EffectiveStatus } from '@/lib/businessLifecycle'
import type { Business } from '@/types'

const STATUS_BADGE_CLASS: Record<EffectiveStatus, string> = {
  trial: 'bg-green-100 text-green-700',
  grace: 'bg-amber-100 text-amber-700',
  active: 'bg-neutral-900 text-white',
  suspended: 'bg-red-100 text-red-700',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-ES')
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isRecent(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < ONE_DAY_MS
}

export function SuperAdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadBusinesses()
  }, [])

  async function loadBusinesses() {
    setLoading(true)
    const { data } = await supabase.from('businesses').select('*').order('created_at', { ascending: false })
    setBusinesses((data as Business[]) ?? [])
    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Negocios</h1>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-2 font-medium">Negocio</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Trial</th>
              <th className="px-4 py-2 font-medium">Gracia</th>
              <th className="px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => {
              const effective = getEffectiveStatus(business)
              const graceEndsAt = business.trial_ends_at
                ? new Date(new Date(business.trial_ends_at).getTime() + 7 * ONE_DAY_MS).toISOString()
                : null
              return (
                <tr key={business.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      to={`/super-admin/negocios/${business.id}`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {business.name}
                    </Link>
                    {isRecent(business.created_at) && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Nuevo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[effective]}`}>
                      {STATUS_LABEL[effective]}
                    </span>
                    {(effective === 'trial' || effective === 'grace') && (
                      <span className="ml-2 text-xs text-neutral-400">{getDaysRemaining(business, effective)}d</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{formatDate(business.trial_ends_at)}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {business.status === 'trial' ? formatDate(graceEndsAt) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <BusinessLifecycleActions business={business} onChanged={loadBusinesses} compact />
                  </td>
                </tr>
              )
            })}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  No hay negocios todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
