import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { flourGramsFrom, gramsForRow } from '@/features/recipes/bakeryFormula'
import type { Ingredient, Recipe, RecipeComponent, RecipeComponentCost, RecipeCost } from '@/types'

// La fórmula panadera en sí (ver bakeryFormula.ts, con tests contra datos
// reales) — este componente solo la usa para calcular los gramos a
// guardar en las mismas columnas quantity/unit que usa el alta manual; el
// motor de costes (recipe_costs / get_recipe_component_costs) no cambia.

export function BakeryComponentsSection({ recipeId, businessId }: { recipeId: string; businessId: string }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [components, setComponents] = useState<RecipeComponent[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [cost, setCost] = useState<RecipeCost | null>(null)
  const [componentCosts, setComponentCosts] = useState<Record<string, RecipeComponentCost>>({})

  const [paston, setPaston] = useState('')
  const [cantidad, setCantidad] = useState('')

  const [addIngredientId, setAddIngredientId] = useState('')
  const [addPercent, setAddPercent] = useState('')
  const [addIsFlourBase, setAddIsFlourBase] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  }, [recipeId, isAdmin])

  async function fetchComponents(): Promise<RecipeComponent[]> {
    const { data } = await supabase
      .from('recipe_components')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('position')
    return (data as RecipeComponent[]) ?? []
  }

  async function loadAll() {
    const [{ data: recipeData }, comps, { data: ings }] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      fetchComponents(),
      supabase.from('ingredients').select('*').order('name'),
    ])

    const r = (recipeData as Recipe) ?? null
    setPaston(r?.paston_grams != null ? String(r.paston_grams) : '')
    setCantidad(r?.paston_quantity != null ? String(r.paston_quantity) : '')
    setComponents(comps)
    setIngredients((ings as Ingredient[]) ?? [])

    if (isAdmin) {
      const [{ data: costData }, { data: componentCostsData }] = await Promise.all([
        supabase.from('recipe_costs').select('*').eq('recipe_id', recipeId).single(),
        supabase.rpc('get_recipe_component_costs', { p_recipe_id: recipeId }),
      ])
      setCost((costData as RecipeCost) ?? null)
      const map: Record<string, RecipeComponentCost> = {}
      for (const c of (componentCostsData as (RecipeComponentCost & { component_id: string })[]) ?? []) {
        map[c.component_id] = c
      }
      setComponentCosts(map)
    }
  }

  function ingredientName(id: string | null) {
    return ingredients.find((i) => i.id === id)?.name ?? 'Ingrediente eliminado'
  }

  async function recalcAndSave(rows: RecipeComponent[], pastonNum: number, cantidadNum: number) {
    if (!pastonNum || !cantidadNum || rows.length === 0) return
    const totalDough = pastonNum * cantidadNum
    const result = flourGramsFrom(rows, totalDough)
    if (!result) return

    await Promise.all(
      rows.map((r) => {
        const grams = gramsForRow(r.flour_percent, result.flourGrams)
        return supabase.from('recipe_components').update({ quantity: grams, unit: 'g' }).eq('id', r.id)
      }),
    )
    void loadAll()
  }

  async function handlePastonBlur() {
    const pastonNum = Number(paston)
    const cantidadNum = Number(cantidad)
    if (!pastonNum || !cantidadNum) return

    await supabase
      .from('recipes')
      .update({ paston_grams: pastonNum, paston_quantity: cantidadNum })
      .eq('id', recipeId)

    await recalcAndSave(components, pastonNum, cantidadNum)
  }

  async function handleAdd() {
    setError(null)

    if (!addIngredientId) {
      setError('Elige un ingrediente.')
      return
    }
    const percentNum = Number(addPercent)
    if (!percentNum || percentNum <= 0) {
      setError('El porcentaje debe ser mayor que 0.')
      return
    }
    const pastonNum = Number(paston)
    const cantidadNum = Number(cantidad)
    if (!pastonNum || !cantidadNum) {
      setError('Define primero el Paston (peso por pieza) y la Cantidad de piezas.')
      return
    }

    const rowsAfter = [...components, { flour_percent: percentNum }]
    const totalDough = pastonNum * cantidadNum
    const result = flourGramsFrom(rowsAfter, totalDough)
    const grams = result ? gramsForRow(percentNum, result.flourGrams) : 0

    const { error: insertError } = await supabase.from('recipe_components').insert({
      business_id: businessId,
      recipe_id: recipeId,
      component_type: 'ingredient',
      ingredient_id: addIngredientId,
      quantity: grams,
      unit: 'g',
      position: components.length,
      is_flour_base: addIsFlourBase,
      flour_percent: percentNum,
    })

    if (insertError) {
      setError('No se pudo añadir el ingrediente.')
      return
    }

    setAddIngredientId('')
    setAddPercent('')
    setAddIsFlourBase(false)

    const fresh = await fetchComponents()
    await recalcAndSave(fresh, pastonNum, cantidadNum)
  }

  async function handleRowChange(id: string, patch: { flour_percent?: number; is_flour_base?: boolean; ingredient_id?: string }) {
    const updated = components.map((c) => (c.id === id ? { ...c, ...patch } : c))
    setComponents(updated)
    await supabase.from('recipe_components').update(patch).eq('id', id)
    await recalcAndSave(updated, Number(paston), Number(cantidad))
  }

  async function handleDelete(id: string) {
    const remaining = components.filter((c) => c.id !== id)
    await supabase.from('recipe_components').delete().eq('id', id)
    setComponents(remaining)
    await recalcAndSave(remaining, Number(paston), Number(cantidad))
  }

  const flourSum = components.reduce((sum, r) => (r.is_flour_base ? sum + (r.flour_percent ?? 0) : sum), 0)
  const totalGrams = components.reduce((sum, r) => sum + r.quantity, 0)
  const pastonReady = Boolean(Number(paston) && Number(cantidad))

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-medium">Fórmula panadera</h2>
      <p className="mt-1 text-sm text-neutral-500">
        La harina es la base 100% — marca qué ingredientes cuentan como harina, el resto se calcula como % de esa
        base.
      </p>

      {isAdmin && cost && (
        <div className="mt-3 space-y-1 rounded-md bg-neutral-50 px-3 py-2 text-sm">
          {cost.is_complete && cost.total_cost != null ? (
            <p>
              Food cost total: <strong>{cost.total_cost.toFixed(2)} €</strong>
              {Number(cantidad) > 0 && (
                <>
                  {' '}
                  — por pieza: <strong>{(cost.total_cost / Number(cantidad)).toFixed(2)} €</strong>
                </>
              )}
            </p>
          ) : (
            <div>
              <p className="font-medium text-amber-600">Food cost incompleto</p>
              <ul className="list-disc pl-5 text-amber-600">
                {cost.missing_reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="paston" className="block text-sm font-medium text-neutral-700">
            Paston (g por pieza)
          </label>
          <input
            id="paston"
            type="number"
            step="any"
            min="0"
            value={paston}
            onChange={(event) => setPaston(event.target.value)}
            onBlur={() => void handlePastonBlur()}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="cantidad" className="block text-sm font-medium text-neutral-700">
            Cantidad (piezas)
          </label>
          <input
            id="cantidad"
            type="number"
            step="1"
            min="0"
            value={cantidad}
            onChange={(event) => setCantidad(event.target.value)}
            onBlur={() => void handlePastonBlur()}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <span className="block text-sm font-medium text-neutral-700">Peso total masa</span>
          <div className="mt-1 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {pastonReady ? `${Number(paston) * Number(cantidad)} g` : '—'}
          </div>
        </div>
      </div>

      {!pastonReady && (
        <p className="mt-2 text-sm text-amber-600">
          Define el Paston y la Cantidad para poder añadir ingredientes.
        </p>
      )}

      {components.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-2 font-medium">Ingrediente</th>
                <th className="py-2 pr-2 text-center font-medium">Harina base</th>
                <th className="py-2 pr-2 text-right font-medium">%</th>
                <th className="py-2 pr-2 text-right font-medium">Gramos</th>
                {isAdmin && <th className="py-2 pr-2 text-right font-medium">Costo</th>}
                <th className="py-2 pr-2" />
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-2">
                    <select
                      aria-label={`Ingrediente de ${ingredientName(c.ingredient_id)}`}
                      value={c.ingredient_id ?? ''}
                      onChange={(event) => void handleRowChange(c.id, { ingredient_id: event.target.value })}
                      className="max-w-[12rem] rounded-md border border-neutral-200 px-1 py-1 text-sm"
                    >
                      {!ingredients.some((i) => i.id === c.ingredient_id) && (
                        <option value={c.ingredient_id ?? ''}>Ingrediente eliminado</option>
                      )}
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={c.is_flour_base}
                      onChange={(event) => void handleRowChange(c.id, { is_flour_base: event.target.checked })}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={c.flour_percent ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        setComponents((prev) =>
                          prev.map((row) => (row.id === c.id ? { ...row, flour_percent: Number(value) } : row)),
                        )
                      }}
                      onBlur={(event) => void handleRowChange(c.id, { flour_percent: Number(event.target.value) })}
                      className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right text-neutral-600">{Math.round(c.quantity)} g</td>
                  {isAdmin && (
                    <td className="py-2 pr-2 text-right text-neutral-600">
                      {componentCosts[c.id]?.component_cost != null
                        ? `${componentCosts[c.id].component_cost!.toFixed(2)} €`
                        : '—'}
                    </td>
                  )}
                  <td className="py-2 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 font-medium">
                <td className="py-2 pr-2">Total</td>
                <td className="py-2 pr-2 text-center" />
                <td className={`py-2 pr-2 text-right ${flourSum !== 100 ? 'text-amber-600' : ''}`}>
                  {flourSum}% base
                </td>
                <td className="py-2 pr-2 text-right">{Math.round(totalGrams)} g</td>
                {isAdmin && <td className="py-2 pr-2" />}
                <td className="py-2 pr-2" />
              </tr>
            </tfoot>
          </table>
          {flourSum !== 100 && (
            <p className="mt-1 text-xs text-amber-600">
              La suma de % marcados como harina base es {flourSum}%, debería dar 100%.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
        {error && <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <select
          value={addIngredientId}
          onChange={(event) => setAddIngredientId(event.target.value)}
          disabled={!pastonReady}
          className="min-w-[10rem] flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm disabled:opacity-50"
        >
          <option value="">Elige un ingrediente</option>
          {ingredients.map((ingredient) => (
            <option key={ingredient.id} value={ingredient.id}>
              {ingredient.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          step="any"
          min="0"
          placeholder="%"
          value={addPercent}
          onChange={(event) => setAddPercent(event.target.value)}
          disabled={!pastonReady}
          className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm disabled:opacity-50"
        />

        <label className="flex items-center gap-1 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={addIsFlourBase}
            onChange={(event) => setAddIsFlourBase(event.target.checked)}
            disabled={!pastonReady}
          />
          Harina base
        </label>

        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!pastonReady}
          className="rounded-md bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Añadir
        </button>
      </div>
    </section>
  )
}
