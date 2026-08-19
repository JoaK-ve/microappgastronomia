import type { Unit } from '@/types'
import { StatusBadge } from '@/features/ingredients/import/StatusBadge'
import { evaluateRow, type NameMatchIndex } from '@/features/ingredients/import/buildRows'
import type { ImportRow, ImportRowAction } from '@/features/ingredients/import/types'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'ud']

function actionOptions(row: ImportRow): { value: ImportRowAction; label: string; disabled?: boolean }[] {
  const hasPurchase = row.price != null && row.quantity != null && row.usageUnit != null

  switch (row.status) {
    case 'new':
      return [
        { value: 'create', label: 'Crear' },
        { value: 'ignore', label: 'Ignorar' },
      ]
    case 'existing':
      return [
        { value: 'ignore', label: 'Mantener' },
        { value: 'update_price', label: 'Actualizar precio', disabled: !hasPurchase },
      ]
    case 'update':
      return [
        { value: 'update_price', label: 'Actualizar precio', disabled: !hasPurchase },
        { value: 'ignore', label: 'Mantener (no actualizar)' },
      ]
    case 'possible_duplicate':
      return [
        { value: 'ignore', label: 'Ignorar' },
        { value: 'update_price', label: 'Es el mismo — actualizar', disabled: !hasPurchase },
        { value: 'create', label: 'Es distinto — crear nuevo' },
      ]
    case 'error':
      return [{ value: 'ignore', label: 'Ignorar (corrige los errores)' }]
    default:
      return [{ value: 'ignore', label: 'Ignorar' }]
  }
}

export function PreviewTable({
  rows,
  index,
  onUpdate,
}: {
  rows: ImportRow[]
  index: NameMatchIndex
  onUpdate: (rows: ImportRow[]) => void
}) {
  function updateRow(clientId: string, patch: Partial<ImportRow>) {
    const next = rows.map((row) => {
      if (row.clientId !== clientId) return row
      const merged = { ...row, ...patch }
      if ('action' in patch && Object.keys(patch).length === 1) {
        return merged
      }
      const revalidated = evaluateRow(
        row.clientId,
        row.rowIndex,
        {
          name: merged.name,
          category: merged.category,
          usageUnitRaw: merged.usageUnitRaw,
          priceRaw: merged.priceRaw,
          quantityRaw: merged.quantityRaw,
          purchaseDescriptionMapped: merged.purchaseDescription,
        },
        index,
      )
      return revalidated
    })
    onUpdate(next)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Categoría</th>
            <th className="px-3 py-2 font-medium">Unidad</th>
            <th className="px-3 py-2 font-medium">Precio</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.clientId} className="border-b border-neutral-100 align-top last:border-0">
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(row.clientId, { name: e.target.value })}
                  className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                {row.status === 'possible_duplicate' && row.matchedIngredientName && (
                  <p className="mt-1 text-xs text-amber-600">Parecido a "{row.matchedIngredientName}"</p>
                )}
                {row.status === 'existing' && row.matchedIngredientName && (
                  <p className="mt-1 text-xs text-blue-600">Ya existe como "{row.matchedIngredientName}"</p>
                )}
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.category ?? ''}
                  onChange={(e) => updateRow(row.clientId, { category: e.target.value || null })}
                  className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={row.usageUnit ?? ''}
                  onChange={(e) => updateRow(row.clientId, { usageUnitRaw: e.target.value })}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.priceRaw ?? ''}
                  placeholder="—"
                  onChange={(e) => updateRow(row.clientId, { priceRaw: e.target.value || null })}
                  className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                {row.price != null && <p className="mt-1 text-xs text-neutral-400">{row.price.toFixed(2)} €</p>}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
                {row.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                    {row.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                <select
                  value={row.action}
                  onChange={(e) => updateRow(row.clientId, { action: e.target.value as ImportRowAction })}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                >
                  {actionOptions(row).map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
