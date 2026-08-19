import { TARGET_FIELD_LABEL, type ColumnMapping, type RawTable, type TargetField } from '@/features/ingredients/import/types'

const FIELD_ORDER: TargetField[] = ['name', 'unit', 'price', 'category', 'quantity', 'purchaseDescription']
const REQUIRED_FIELDS: TargetField[] = ['name', 'unit']

type Props = {
  table: RawTable
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
  onBack: () => void
  onContinue: () => void
}

export function MappingStep({ table, mapping, onChange, onBack, onContinue }: Props) {
  const missingRequired = REQUIRED_FIELDS.filter((f) => mapping[f] == null)
  const usedColumns = new Set(Object.values(mapping).filter((v): v is number => v != null))

  function handleFieldChange(field: TargetField, value: string) {
    const columnIndex = value === '' ? null : Number(value)
    onChange({ ...mapping, [field]: columnIndex })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mapeo de columnas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Revisa cómo hemos interpretado tus columnas. Puedes cambiarlas antes de continuar.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-2 font-medium">Fuente</th>
              <th className="px-4 py-2 font-medium" />
              <th className="px-4 py-2 font-medium">OídoChef</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_ORDER.map((field) => {
              const currentIndex = mapping[field]
              return (
                <tr key={field} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-700">
                    {currentIndex != null ? table.headers[currentIndex] : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-neutral-300">→</td>
                  <td className="px-4 py-2">
                    <select
                      value={currentIndex ?? ''}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Sin utilizar</option>
                      {table.headers.map((header, i) => (
                        <option
                          key={i}
                          value={i}
                          disabled={usedColumns.has(i) && currentIndex !== i}
                        >
                          {header || `Columna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                    <span className="ml-2 text-xs text-neutral-500">{TARGET_FIELD_LABEL[field]}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {missingRequired.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Falta mapear: {missingRequired.map((f) => TARGET_FIELD_LABEL[f]).join(', ')}. Estos campos son obligatorios.
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={missingRequired.length > 0}
          onClick={onContinue}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
