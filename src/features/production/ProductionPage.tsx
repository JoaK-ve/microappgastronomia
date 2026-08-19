import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Production, ProductionReference, Profile, Recipe } from '@/types'

// Sin decimales, redondeado al múltiplo de 5 más cercano (lo que de verdad
// se puede leer en una báscula de cocina) — nunca a 0 si el valor es > 0.
function formatQuantity(value: number | null) {
  if (value == null || value <= 0) return '0'
  const rounded = Math.round(value / 5) * 5
  return String(rounded === 0 ? 5 : rounded)
}

export function ProductionPage() {
  const [searchParams] = useSearchParams()
  const preselectedRecipeId = searchParams.get('receta')

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [recentProductions, setRecentProductions] = useState<Production[]>([])

  const [selectedRecipeId, setSelectedRecipeId] = useState(preselectedRecipeId ?? '')
  const [reference, setReference] = useState<ProductionReference | null>(null)
  const [loadingReference, setLoadingReference] = useState(false)

  const [quantity, setQuantity] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastProduction, setLastProduction] = useState<Production | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (!selectedRecipeId) {
      setReference(null)
      return
    }
    setLoadingReference(true)
    setReference(null)
    supabase
      .rpc('get_recipe_production_reference', { p_recipe_id: selectedRecipeId })
      .then(({ data }) => {
        const rows = data as ProductionReference[] | null
        setReference(rows?.[0] ?? null)
        setLoadingReference(false)
      })
  }, [selectedRecipeId])

  async function loadAll() {
    setLoading(true)
    const [{ data: recs }, { data: profs }, { data: prods }] = await Promise.all([
      supabase.from('recipes').select('*').order('name'),
      supabase.from('profiles').select('*'),
      supabase.from('productions').select('*').order('created_at', { ascending: false }).limit(10),
    ])
    setRecipes((recs as Recipe[]) ?? [])
    setProfiles((profs as Profile[]) ?? [])
    setRecentProductions((prods as Production[]) ?? [])
    setLoading(false)
  }

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId],
  )

  function recipeName(recipeId: string) {
    return recipes.find((r) => r.id === recipeId)?.name ?? 'Receta eliminada'
  }

  function producerName(userId: string | null) {
    if (!userId) return '—'
    return profiles.find((p) => p.id === userId)?.name ?? '—'
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!selectedRecipe || !quantity) return

    setGenerating(true)

    const { data, error: rpcError } = await supabase.rpc('generate_production', {
      p_recipe_id: selectedRecipe.id,
      p_requested_quantity: Number(quantity),
    })

    setGenerating(false)

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'No se pudo generar la hoja de producción.')
      return
    }

    setLastProduction(data as Production)
    setQuantity('')
    void loadAll()
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold print:hidden">Producción</h1>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 print:hidden">
        <h2 className="text-lg font-medium">Generar hoja de producción</h2>

        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="recipe" className="block text-sm font-medium text-neutral-700">
              Receta
            </label>
            <select
              id="recipe"
              value={selectedRecipeId}
              onChange={(event) => {
                setSelectedRecipeId(event.target.value)
                setLastProduction(null)
                setError(null)
              }}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Elige una receta…</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRecipe && loadingReference && <p className="text-sm text-neutral-500">Cargando…</p>}

          {selectedRecipe && !loadingReference && reference?.error_reason && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{reference.error_reason}</p>
          )}

          {selectedRecipe && !loadingReference && reference && !reference.error_reason && (
            <form onSubmit={handleGenerate} className="space-y-3">
              <p className="text-sm text-neutral-600">
                {reference.source === 'yield'
                  ? 'Rendimiento estándar'
                  : 'Cantidad base de la fórmula (sin rendimiento definido)'}
                : <strong>{formatQuantity(reference.reference_quantity)} {reference.reference_unit}</strong>
              </p>

              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-neutral-700">
                  ¿Cuánto quieres producir? ({reference.reference_unit})
                </label>
                <input
                  id="quantity"
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
          )}
        </div>
      </section>

      {lastProduction && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4 print:border-0 print:p-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Hoja de producción generada</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {recipeName(lastProduction.recipe_id)} — {lastProduction.requested_quantity}{' '}
                {lastProduction.requested_unit} (factor {lastProduction.scale_factor.toFixed(4)})
              </p>
            </div>
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
              {lastProduction.resulting_components.map((component, index) => (
                <tr key={index} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-4">
                    {component.name}
                    {component.component_type === 'recipe' && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
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
              {lastProduction.resulting_components.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-neutral-400">
                    Esta receta no tiene componentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {lastProduction.resulting_components.some((c) => c.component_type === 'recipe') && (
            <p className="mt-2 text-xs text-neutral-500">
              Las subrecetas se muestran como componente directo, sin desplegar sus propios ingredientes. Para
              producirlas, genera su propia hoja de producción.
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-4 print:hidden">
        <h2 className="text-lg font-medium">Producciones recientes</h2>
        {recentProductions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Todavía no se ha generado ninguna producción.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {recentProductions.map((production) => (
              <li key={production.id} className="py-2">
                <p className="font-medium">
                  {recipeName(production.recipe_id)} — {production.requested_quantity} {production.requested_unit}
                </p>
                <p className="text-neutral-500">
                  {new Date(production.created_at).toLocaleString('es-ES')} · {producerName(production.produced_by)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
