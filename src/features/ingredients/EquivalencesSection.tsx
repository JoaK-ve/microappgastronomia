import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { IngredientEquivalence, Unit } from '@/types'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'ud']

export function EquivalencesSection({ ingredientId, businessId }: { ingredientId: string; businessId: string }) {
  const [equivalences, setEquivalences] = useState<IngredientEquivalence[]>([])
  const [fromQuantity, setFromQuantity] = useState('')
  const [fromUnit, setFromUnit] = useState<Unit>('ud')
  const [toQuantity, setToQuantity] = useState('')
  const [toUnit, setToUnit] = useState<Unit>('g')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadEquivalences()
  }, [ingredientId])

  async function loadEquivalences() {
    const { data } = await supabase
      .from('ingredient_equivalences')
      .select('*')
      .eq('ingredient_id', ingredientId)
    setEquivalences((data as IngredientEquivalence[]) ?? [])
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const { error: insertError } = await supabase.from('ingredient_equivalences').insert({
      business_id: businessId,
      ingredient_id: ingredientId,
      from_quantity: Number(fromQuantity),
      from_unit: fromUnit,
      to_quantity: Number(toQuantity),
      to_unit: toUnit,
    })

    if (insertError) {
      setError('No se pudo añadir la equivalencia.')
      return
    }

    setFromQuantity('')
    setToQuantity('')
    void loadEquivalences()
  }

  async function handleDelete(id: string) {
    await supabase.from('ingredient_equivalences').delete().eq('id', id)
    void loadEquivalences()
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-medium">Equivalencias</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Solo cuando haya un dato conocido (ej. 1 ud ≈ 50 g). Nunca se asumen automáticamente.
      </p>

      {equivalences.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-100">
          {equivalences.map((eq) => (
            <li key={eq.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {eq.from_quantity} {eq.from_unit} ≈ {eq.to_quantity} {eq.to_unit}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(eq.id)}
                className="text-neutral-400 hover:text-red-600"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
        {error && <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <input
          type="number"
          step="any"
          min="0"
          required
          placeholder="Cantidad"
          value={fromQuantity}
          onChange={(event) => setFromQuantity(event.target.value)}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <select
          value={fromUnit}
          onChange={(event) => setFromUnit(event.target.value as Unit)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="text-neutral-500">≈</span>
        <input
          type="number"
          step="any"
          min="0"
          required
          placeholder="Cantidad"
          value={toQuantity}
          onChange={(event) => setToQuantity(event.target.value)}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <select
          value={toUnit}
          onChange={(event) => setToUnit(event.target.value as Unit)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
          Añadir
        </button>
      </form>
    </section>
  )
}
