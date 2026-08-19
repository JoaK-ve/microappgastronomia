import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Business, BusinessLifecycleEvent, PlatformAuditLogEntry } from '@/types'

const ACTION_LABEL: Record<string, string> = {
  business_profile_updated: 'Editó los datos del negocio',
  user_role_changed: 'Cambió el rol de un usuario',
  user_invited: 'Invitó a un usuario',
  user_deleted: 'Eliminó a un usuario',
  access_recovery_sent: 'Envió recuperación de acceso',
}

type CombinedEntry = {
  id: string
  createdAt: string
  businessName: string
  description: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-ES')
}

export function SuperAdminAuditPage() {
  const [entries, setEntries] = useState<CombinedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: auditData }, { data: lifecycleData }, { data: businessesData }] = await Promise.all([
      supabase.from('platform_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('business_lifecycle_events').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('businesses').select('*'),
    ])

    const businessNames: Record<string, string> = {}
    for (const business of (businessesData as Business[]) ?? []) businessNames[business.id] = business.name

    const combined: CombinedEntry[] = []

    for (const entry of (auditData as PlatformAuditLogEntry[]) ?? []) {
      combined.push({
        id: `audit-${entry.id}`,
        createdAt: entry.created_at,
        businessName: entry.business_id ? (businessNames[entry.business_id] ?? entry.business_id) : '—',
        description: ACTION_LABEL[entry.action] ?? entry.action,
      })
    }

    for (const event of (lifecycleData as BusinessLifecycleEvent[]) ?? []) {
      combined.push({
        id: `lifecycle-${event.id}`,
        createdAt: event.created_at,
        businessName: businessNames[event.business_id] ?? event.business_id,
        description: `Ciclo de vida: ${event.previous_status ?? '—'} → ${event.new_status}`,
      })
    }

    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    setEntries(combined)
    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Auditoría</h1>
      <p className="text-sm text-neutral-500">
        Acciones de plataforma ejecutadas por Super Admin sobre cualquier negocio, más el historial de ciclo de
        vida (activación/suspensión/renovación de trial).
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Negocio</th>
              <th className="px-4 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-500">{formatDateTime(entry.createdAt)}</td>
                <td className="px-4 py-2">{entry.businessName}</td>
                <td className="px-4 py-2">{entry.description}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                  Sin actividad todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
