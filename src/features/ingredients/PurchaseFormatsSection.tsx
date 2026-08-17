import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { IngredientCost, PurchaseFormat, Unit } from '@/types'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'ud']

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function PurchaseFormatsSection({ ingredientId, businessId }: { ingredientId: string; businessId: string }) {
  const [formats, setFormats] = useState<PurchaseFormat[]>([])
  const [cost, setCost] = useState<IngredientCost | null>(null)

  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [price, setPrice] = useState('')
  const [priceDate, setPriceDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  }, [ingredientId])

  async function loadAll() {
    const [{ data: fmts }, { data: costData }] = await Promise.all([
      supabase
        .from('purchase_formats')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('price_date', { ascending: false }),
      supabase.from('ingredient_costs').select('*').eq('ingredient_id', ingredientId).single(),
    ])
    setFormats((fmts as PurchaseFormat[]) ?? [])
    setCost((costData as IngredientCost) ?? null)
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const { error: insertError } = await supabase.from('purchase_formats').insert({
      business_id: businessId,
      ingredient_id: ingredientId,
      description,
      quantity: Number(quantity),
      unit,
      price: Number(price),
      price_date: priceDate,
    })

    if (insertError) {
      setError('No se pudo añadir el formato de compra.')
      return
    }

    setDescription('')
    setQuantity('')
    setPrice('')
    setPriceDate(todayIso())
    void loadAll()
  }

  async function handleDelete(id: string) {
    await supabase.from('purchase_formats').delete().eq('id', id)
    void loadAll()
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-medium">Formatos de compra</h2>

      <div className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm">
        {cost?.unit_cost != null ? (
          <span>
            Coste actual: <strong>{cost.unit_cost.toFixed(4)} €</strong> por unidad de uso
          </span>
        ) : (
          <span className="text-amber-600">{cost?.missing_reason ?? 'Añade un formato de compra para calcular el coste.'}</span>
        )}
      </div>

      {formats.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4 font-medium">Descripción</th>
                <th className="py-2 pr-4 font-medium">Cantidad</th>
                <th className="py-2 pr-4 font-medium">Precio</th>
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {formats.map((format) => (
                <tr key={format.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-4">{format.description}</td>
                  <td className="py-2 pr-4">
                    {format.quantity} {format.unit}
                  </td>
                  <td className="py-2 pr-4">{format.price.toFixed(2)} €</td>
                  <td className="py-2 pr-4 text-neutral-500">{format.price_date}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(format.id)}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
        {error && <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <input
          type="text"
          required
          placeholder="Descripción (ej. Caja 30 ud)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-w-[10rem] flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          step="any"
          min="0"
          required
          placeholder="Cantidad"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value as Unit)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="any"
          min="0"
          required
          placeholder="Precio €"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          required
          value={priceDate}
          onChange={(event) => setPriceDate(event.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
          Añadir
        </button>
      </form>
    </section>
  )
}
