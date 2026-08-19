import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { Production, ProductionReference, Recipe } from '@/types'

// Sin decimales, redondeado al múltiplo de 5 más cercano (lo que de verdad
// se puede leer en una báscula de cocina) — nunca a 0 si el valor es > 0.
function formatQuantity(value: number | null) {
  if (value == null || value <= 0) return '0'
  const rounded = Math.round(value / 5) * 5
  return String(rounded === 0 ? 5 : rounded)
}

export function ProducirView({ recipe }: { recipe: Recipe }) {
  const [reference, setReference] = useState<ProductionReference | null>(null)
  const [loadingReference, setLoadingReference] = useState(true)

  const [quantity, setQuantity] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Production | null>(null)

  useEffect(() => {
    setLoadingReference(true)
    setResult(null)
    supabase
      .rpc('get_recipe_production_reference', { p_recipe_id: recipe.id })
      .then(({ data }) => {
        const rows = data as ProductionReference[] | null
        setReference(rows?.[0] ?? null)
        setLoadingReference(false)
      })
  }, [recipe.id])

  if (loadingReference) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (!reference || reference.error_reason) {
    return (
      <p className="text-sm text-amber-600">
        {reference?.error_reason ?? 'No se pudo calcular una cantidad base para producir esta receta.'}
      </p>
    )
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setGenerating(true)

    const { data, error: rpcError } = await supabase.rpc('generate_production', {
      p_recipe_id: recipe.id,
      p_requested_quantity: Number(quantity),
    })

    setGenerating(false)

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'No se pudo generar la hoja de producción.')
      return
    }

    setResult(data as Production)
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <form onSubmit={handleGenerate} className="space-y-3 print:hidden">
        <p className="text-sm text-neutral-600">
          {reference.source === 'yield' ? 'Rendimiento estándar' : 'Cantidad base de la fórmula (sin rendimiento definido)'}
          : <strong>{formatQuantity(reference.reference_quantity)} {reference.reference_unit}</strong>
        </p>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label htmlFor="producirQuantity" className="block text-sm font-medium text-neutral-700">
            ¿Cuánto quieres producir? ({reference.reference_unit})
          </label>
          <input
            id="producirQuantity"
            type="number"
            step="any"
            min="0"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-1 w-40 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generating ? 'Generando…' : 'Generar hoja de producción'}
        </button>
      </form>

      {result && (
        <section>
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-neutral-600">
              {result.requested_quantity} {result.requested_unit} (factor {result.scale_factor.toFixed(4)})
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white print:hidden"
            >
              Imprimir / PDF
            </button>
          </div>

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4 font-medium">Componente</th>
                <th className="py-2 pr-4 font-medium">Cantidad original</th>
                <th className="py-2 font-medium">Cantidad a producir</th>
              </tr>
            </thead>
            <tbody>
              {result.resulting_components.map((component, index) => (
                <tr key={index} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-4">
                    {component.name}
                    {component.component_type === 'recipe' && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 print:hidden">
                        receta
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-neutral-500">
                    {formatQuantity(component.original_quantity)} {component.unit}
                  </td>
                  <td className="py-2 font-medium">
                    {formatQuantity(component.scaled_quantity)} {component.unit}
                  </td>
                </tr>
              ))}
              {result.resulting_components.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-neutral-400">
                    Esta receta no tiene componentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
