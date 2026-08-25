import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  getDaysRemaining,
  getEffectiveStatus,
  STATUS_LABEL,
  STORED_STATUS_LABEL,
  type EffectiveStatus,
} from '@/lib/businessLifecycle'
import type { Business, BusinessLifecycleEvent, PlatformAuditLogEntry } from '@/types'

const STATUS_ORDER: EffectiveStatus[] = ['trial', 'grace', 'active', 'suspended']
const ENDING_SOON_DAYS = 3

const STATUS_BADGE_CLASS: Record<EffectiveStatus, string> = {
  trial: 'bg-green-100 text-green-700',
  grace: 'bg-amber-100 text-amber-700',
  active: 'bg-neutral-900 text-white',
  suspended: 'bg-red-100 text-red-700',
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  business_profile_updated: 'Editó los datos del negocio',
  user_role_changed: 'Cambió el rol de un usuario',
  user_invited: 'Invitó a un usuario',
  user_deleted: 'Eliminó a un usuario',
  access_recovery_sent: 'Envió recuperación de acceso',
}

type BusinessWithStats = Business & { userCount: number; ingredientCount: number }

type ActivityEntry = {
  id: string
  createdAt: string
  businessId: string | null
  businessName: string
  description: string
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'ayer'
  return `hace ${diffD} días`
}

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<BusinessWithStats[]>([])
  const [userCount, setUserCount] = useState(0)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: businessesData }, { count }, { data: auditData }, { data: lifecycleData }] = await Promise.all([
      supabase.from('businesses').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('platform_audit_log').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('business_lifecycle_events').select('*').order('created_at', { ascending: false }).limit(5),
    ])

    const rawBusinesses = (businessesData as Business[]) ?? []

    // Solo 3 negocios hoy: una consulta de conteo por negocio es simple y
    // suficiente. Si esto crece mucho, se puede sustituir por una vista.
    const withStats: BusinessWithStats[] = await Promise.all(
      rawBusinesses.map(async (business) => {
        const [{ count: userCountForBusiness }, { count: ingredientCountForBusiness }] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
          supabase.from('ingredients').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
        ])
        return { ...business, userCount: userCountForBusiness ?? 0, ingredientCount: ingredientCountForBusiness ?? 0 }
      }),
    )

    const businessNames: Record<string, string> = {}
    for (const business of rawBusinesses) businessNames[business.id] = business.name

    const activityEntries: ActivityEntry[] = [
      ...((auditData as PlatformAuditLogEntry[]) ?? []).map((entry) => ({
        id: `audit-${entry.id}`,
        createdAt: entry.created_at,
        businessId: entry.business_id,
        businessName: entry.business_id ? (businessNames[entry.business_id] ?? '—') : '—',
        description: AUDIT_ACTION_LABEL[entry.action] ?? entry.action,
      })),
      ...((lifecycleData as BusinessLifecycleEvent[]) ?? []).map((event) => ({
        id: `lifecycle-${event.id}`,
        createdAt: event.created_at,
        businessId: event.business_id,
        businessName: businessNames[event.business_id] ?? '—',
        description: `Ciclo de vida: ${event.previous_status ? STORED_STATUS_LABEL[event.previous_status] : '—'} → ${STORED_STATUS_LABEL[event.new_status]}`,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    setBusinesses(withStats)
    setUserCount(count ?? 0)
    setActivity(activityEntries)
    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  const countsByStatus: Record<EffectiveStatus, number> = { trial: 0, grace: 0, active: 0, suspended: 0 }
  for (const business of businesses) {
    countsByStatus[getEffectiveStatus(business)]++
  }

  const endingSoonCount = businesses.filter((business) => {
    const effective = getEffectiveStatus(business)
    return (effective === 'trial' || effective === 'grace') && getDaysRemaining(business, effective) <= ENDING_SOON_DAYS
  }).length

  const recentBusinesses = businesses.slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => navigate('/super-admin/negocios')}
          className="rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400 hover:shadow-sm"
        >
          <p className="text-xs text-neutral-500">Negocios</p>
          <p className="mt-1 text-2xl font-semibold">{businesses.length}</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/super-admin/negocios')}
          className={`rounded-lg border p-4 text-left transition hover:shadow-sm ${
            endingSoonCount > 0
              ? 'border-amber-200 bg-amber-50 hover:border-amber-400'
              : 'border-neutral-200 bg-white hover:border-neutral-400'
          }`}
        >
          <p className={`text-xs ${endingSoonCount > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
            {endingSoonCount > 0 && '⚠️ '}Vencen pronto
          </p>
          <p className={`mt-1 text-2xl font-semibold ${endingSoonCount > 0 ? 'text-amber-700' : ''}`}>
            {endingSoonCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/super-admin/usuarios')}
          className="rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400 hover:shadow-sm"
        >
          <p className="text-xs text-neutral-500">Usuarios totales</p>
          <p className="mt-1 text-2xl font-semibold">{userCount}</p>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-3">
            <p className="text-xs text-neutral-500">{STATUS_LABEL[status]}</p>
            <p className="mt-1 text-xl font-semibold">{countsByStatus[status]}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Negocios recientes</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {recentBusinesses.map((business) => {
            const effective = getEffectiveStatus(business)
            return (
              <Link
                key={business.id}
                to={`/super-admin/negocios/${business.id}`}
                className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-0 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{business.name}</p>
                  <p className="text-xs text-neutral-500">
                    {business.userCount} usuario{business.userCount === 1 ? '' : 's'} · {business.ingredientCount}{' '}
                    ingrediente{business.ingredientCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[effective]}`}
                >
                  {STATUS_LABEL[effective]}
                  {(effective === 'trial' || effective === 'grace') && ` · ${getDaysRemaining(business, effective)}d`}
                </span>
              </Link>
            )
          })}
          {recentBusinesses.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">No hay negocios todavía.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Actividad reciente</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {activity.map((entry) => (
            <Link
              key={entry.id}
              to={entry.businessId ? `/super-admin/negocios/${entry.businessId}` : '/super-admin/auditoria'}
              className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-0 hover:bg-neutral-50"
            >
              <span className="truncate text-neutral-700">
                {entry.description} en <strong>{entry.businessName}</strong>
              </span>
              <span className="shrink-0 text-xs text-neutral-400">{relativeTime(entry.createdAt)}</span>
            </Link>
          ))}
          {activity.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">Sin actividad todavía.</p>
          )}
        </div>
      </section>
    </div>
  )
}
