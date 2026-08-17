import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Recipe } from '@/types'

function formatYield(recipe: Recipe) {
  if (recipe.yield_quantity == null || !recipe.yield_unit) return '—'
  return `${recipe.yield_quantity} ${recipe.yield_unit}`
}

export function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadRecipes()
  }, [])

  async function loadRecipes() {
    setLoading(true)
    const { data } = await supabase.from('recipes').select('*').order('name')
    setRecipes((data as Recipe[]) ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(q))
  }, [recipes, search])

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recetas</h1>
        <Link to="/recetas/nueva" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          + Nueva receta
        </Link>
      </div>

      <input
        type="search"
        placeholder="Buscar receta…"
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
              <th className="px-4 py-2 font-medium">Rendimiento</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((recipe) => (
              <tr key={recipe.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2">
                  <Link to={`/recetas/${recipe.id}`} className="font-medium text-neutral-900 hover:underline">
                    {recipe.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">{recipe.category ?? '—'}</td>
                <td className="px-4 py-2 text-neutral-600">{formatYield(recipe)}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {recipe.status === 'active' ? 'Activa' : 'Archivada'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No hay recetas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
