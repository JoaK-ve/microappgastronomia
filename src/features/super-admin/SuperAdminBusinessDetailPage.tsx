import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { BusinessLifecycleActions } from '@/components/BusinessLifecycleActions'
import {
  getEffectiveStatus,
  getDaysRemaining,
  STATUS_LABEL,
  STORED_STATUS_LABEL,
  type EffectiveStatus,
} from '@/lib/businessLifecycle'
import type { Business, BusinessLifecycleEvent } from '@/types'

const STATUS_BADGE_CLASS: Record<EffectiveStatus, string> = {
  trial: 'bg-green-100 text-green-700',
  grace: 'bg-amber-100 text-amber-700',
  active: 'bg-neutral-900 text-white',
  suspended: 'bg-red-100 text-red-700',
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES')
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function SuperAdminBusinessDetailPage() {
  const { id } = useParams()
  const [business, setBusiness] = useState<Business | null>(null)
  const [events, setEvents] = useState<BusinessLifecycleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    void loadBusiness(id)
  }, [id])

  async function loadBusiness(businessId: string) {
    setLoading(true)
    const [{ data }, { data: eventsData }] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', businessId).single(),
      supabase
        .from('business_lifecycle_events')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
    ])
    if (data) {
      setBusiness(data as Business)
    } else {
      setNotFound(true)
    }
    setEvents((eventsData as BusinessLifecycleEvent[]) ?? [])
    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  if (notFound || !business) {
    return <p className="text-neutral-500">Negocio no encontrado.</p>
  }

  const effective = getEffectiveStatus(business)
  const daysRemaining = getDaysRemaining(business, effective)
  const graceEndsAt = business.trial_ends_at
    ? new Date(new Date(business.trial_ends_at).getTime() + 7 * ONE_DAY_MS).toISOString()
    : null

  return (
    <div className="max-w-2xl space-y-4">
      <Link to="/super-admin" className="text-sm text-neutral-500 hover:underline">
        ← Negocios
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{business.name}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[effective]}`}>
          {STATUS_LABEL[effective]}
        </span>
        {effective !== 'suspended' && effective !== 'active' && (
          <span className="text-xs text-neutral-500">
            {daysRemaining} día{daysRemaining === 1 ? '' : 's'} restante{daysRemaining === 1 ? '' : 's'}
          </span>
        )}
      </div>

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
            <dt className="text-neutral-500">Estado (guardado)</dt>
            <dd>{STORED_STATUS_LABEL[business.status]}</dd>
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
            <dt className="text-neutral-500">Vencimiento de gracia</dt>
            <dd>{business.status === 'trial' ? formatDateTime(graceEndsAt) : '—'}</dd>
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

        <div className="mt-4 border-t border-neutral-100 pt-4">
          <BusinessLifecycleActions business={business} onChanged={() => id && loadBusiness(id)} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Historial de ciclo de vida</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Sin cambios de estado todavía.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {events.map((event) => (
              <li key={event.id} className="py-2">
                <p>
                  {event.previous_status ? STORED_STATUS_LABEL[event.previous_status] : '—'} →{' '}
                  <strong>{STORED_STATUS_LABEL[event.new_status]}</strong>
                </p>
                <p className="text-xs text-neutral-500">{formatDateTime(event.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
