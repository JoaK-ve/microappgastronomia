import type { ImportRowStatus } from '@/features/ingredients/import/types'

const STATUS_META: Record<ImportRowStatus, { label: string; icon: string; className: string }> = {
  new: { label: 'Nuevo', icon: '🟢', className: 'bg-green-50 text-green-700' },
  existing: { label: 'Existente', icon: '🔵', className: 'bg-blue-50 text-blue-700' },
  possible_duplicate: { label: 'Posible duplicado', icon: '🟡', className: 'bg-amber-50 text-amber-700' },
  update: { label: 'Actualizar', icon: '🟠', className: 'bg-orange-50 text-orange-700' },
  error: { label: 'Error', icon: '🔴', className: 'bg-red-50 text-red-700' },
  ignored: { label: 'Ignorar', icon: '⚪', className: 'bg-neutral-100 text-neutral-500' },
}

export function StatusBadge({ status }: { status: ImportRowStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  )
}
