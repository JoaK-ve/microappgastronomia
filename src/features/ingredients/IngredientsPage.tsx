import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { Ingredient, IngredientCost } from '@/types'

export function IngredientsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [costs, setCosts] = useState<Record<string, IngredientCost>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [isAdmin])

  async function loadData() {
    setLoading(true)

    const { data: ingredientsData } = await supabase.from('ingredients').select('*').order('name')
    setIngredients((ingredientsData as Ingredient[]) ?? [])

    if (isAdmin) {
      const { data: costsData } = await supabase.from('ingredient_costs').select('*')
      const map: Record<string, IngredientCost> = {}
      for (const cost of (costsData as IngredientCost[]) ?? []) {
        map[cost.ingredient_id] = cost
      }
      setCosts(map)
    } else {
      setCosts({})
    }

    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingredients
    return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(q))
  }, [ingredients, search])

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ingredientes</h1>
        {isAdmin && (
          <Link
            to="/ingredientes/nuevo"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            + Nuevo ingrediente
          </Link>
        )}
      </div>

      <input
        type="search"
        placeholder="Buscar ingrediente…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              {isAdmin && <th className="px-4 py-2 font-medium">Coste actual</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ingredient) => {
              const cost = costs[ingredient.id]
              return (
                <tr key={ingredient.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">
                    {isAdmin ? (
                      <Link
                        to={`/ingredientes/${ingredient.id}`}
                        className="font-medium text-neutral-900 hover:underline"
                      >
                        {ingredient.name}
                      </Link>
                    ) : (
                      ingredient.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{ingredient.category ?? '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      {cost?.unit_cost != null ? (
                        `${cost.unit_cost.toFixed(4)} €/${ingredient.usage_unit}`
                      ) : (
                        <span className="text-amber-600" title={cost?.missing_reason ?? undefined}>
                          Pendiente
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 3 : 2} className="px-4 py-6 text-center text-neutral-400">
                  No hay ingredientes todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
