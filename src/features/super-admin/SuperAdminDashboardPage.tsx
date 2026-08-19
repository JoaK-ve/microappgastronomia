import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getEffectiveStatus, STATUS_LABEL, type EffectiveStatus } from '@/lib/businessLifecycle'
import type { Business } from '@/types'

const STATUS_ORDER: EffectiveStatus[] = ['trial', 'grace', 'active', 'suspended']

export function SuperAdminDashboardPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [userCount, setUserCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: businessesData }, { count }] = await Promise.all([
      supabase.from('businesses').select('*'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    setBusinesses((businessesData as Business[]) ?? [])
    setUserCount(count ?? 0)
    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  const countsByStatus: Record<EffectiveStatus, number> = { trial: 0, grace: 0, active: 0, suspended: 0 }
  for (const business of businesses) {
    countsByStatus[getEffectiveStatus(business)]++
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Negocios</p>
          <p className="mt-1 text-2xl font-semibold">{businesses.length}</p>
        </div>
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">{STATUS_LABEL[status]}</p>
            <p className="mt-1 text-2xl font-semibold">{countsByStatus[status]}</p>
          </div>
        ))}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Usuarios</p>
          <p className="mt-1 text-2xl font-semibold">{userCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/super-admin/negocios" className="text-neutral-700 underline underline-offset-2">
          Ver negocios
        </Link>
        <Link to="/super-admin/usuarios" className="text-neutral-700 underline underline-offset-2">
          Ver usuarios
        </Link>
        <Link to="/super-admin/auditoria" className="text-neutral-700 underline underline-offset-2">
          Ver auditoría
        </Link>
      </div>
    </div>
  )
}
