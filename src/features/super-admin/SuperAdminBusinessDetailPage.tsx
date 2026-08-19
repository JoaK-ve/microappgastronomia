import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Business } from '@/types'

const STATUS_LABEL: Record<Business['status'], string> = {
  trial: 'Trial',
  active: 'Active',
  expired: 'Expired',
  suspended: 'Suspended',
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES')
}

export function SuperAdminBusinessDetailPage() {
  const { id } = useParams()
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    void loadBusiness(id)
  }, [id])

  async function loadBusiness(businessId: string) {
    setLoading(true)
    const { data } = await supabase.from('businesses').select('*').eq('id', businessId).single()
    if (data) {
      setBusiness(data as Business)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  if (notFound || !business) {
    return <p className="text-neutral-500">Negocio no encontrado.</p>
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Link to="/super-admin" className="text-sm text-neutral-500 hover:underline">
        ← Negocios
      </Link>
      <h1 className="text-2xl font-semibold">{business.name}</h1>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Datos básicos</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Email</dt>
            <dd>{business.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Teléfono</dt>
            <dd>{business.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Estado</dt>
            <dd>{STATUS_LABEL[business.status]}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Creado</dt>
            <dd>{formatDateTime(business.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Ciclo de vida</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Inicio del trial</dt>
            <dd>{formatDateTime(business.trial_started_at)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Vencimiento del trial</dt>
            <dd>{formatDateTime(business.trial_ends_at)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Fecha de activación</dt>
            <dd>{formatDateTime(business.activated_at)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Fecha de suspensión</dt>
            <dd>{formatDateTime(business.suspended_at)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
