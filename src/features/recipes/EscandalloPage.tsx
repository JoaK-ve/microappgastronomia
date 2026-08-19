import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { Recipe, RecipeCategory, RecipeCost } from '@/types'

function formatYield(recipe: Recipe) {
  if (recipe.yield_quantity == null || !recipe.yield_unit) return '—'
  return `${recipe.yield_quantity} ${recipe.yield_unit}`
}

export function EscandalloPage() {
  const { profile, loading: authLoading } = useAuth()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [costs, setCosts] = useState<Record<string, RecipeCost>>({})
  const [categories, setCategories] = useState<RecipeCategory[]>([])
  const [subrecipeIds, setSubrecipeIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.role !== 'admin') return
    void loadData()
  }, [profile?.role])

  async function loadData() {
    setLoading(true)

    const [{ data: recipesData }, { data: costsData }, { data: categoriesData }, { data: componentsData }] =
      await Promise.all([
        supabase.from('recipes').select('*').order('name'),
        supabase.from('recipe_costs').select('*'),
        supabase.from('recipe_categories').select('*').order('name'),
        supabase.from('recipe_components').select('component_recipe_id').eq('component_type', 'recipe'),
      ])

    setRecipes((recipesData as Recipe[]) ?? [])

    const costMap: Record<string, RecipeCost> = {}
    for (const cost of (costsData as RecipeCost[]) ?? []) costMap[cost.recipe_id] = cost
    setCosts(costMap)

    setCategories((categoriesData as RecipeCategory[]) ?? [])

    const subIds = new Set<string>()
    for (const component of (componentsData as { component_recipe_id: string | null }[]) ?? []) {
      if (component.component_recipe_id) subIds.add(component.component_recipe_id)
    }
    setSubrecipeIds(subIds)

    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipes.filter((recipe) => {
      const matchesSearch =
        !q || recipe.name.toLowerCase().includes(q) || (recipe.code ?? '').toLowerCase().includes(q)
      const matchesCategory = !categoryFilter || recipe.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [recipes, search, categoryFilter])

  // Protección también en el cliente (acceso por URL directa): la
  // protección real es RLS/purchase_formats (cocina nunca recibe un coste
  // real por API aunque llegue aquí), esto solo evita que vea la pantalla.
  if (profile && profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (authLoading || loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">Escandallo</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Imprimir escandallo
        </button>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-semibold">Escandallo</h1>
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <input
          type="search"
          placeholder="Buscar por nombre o código…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white print:border-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Receta</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Rendimiento</th>
              <th className="px-4 py-2 font-medium">Coste total</th>
              <th className="px-4 py-2 font-medium">Coste por unidad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((recipe) => {
              const cost = costs[recipe.id]
              return (
                <tr key={recipe.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-600">{recipe.code ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Link to={`/recetas/${recipe.id}`} className="font-medium text-neutral-900 hover:underline">
                      {recipe.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{recipe.category ?? '—'}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {subrecipeIds.has(recipe.id) ? 'Subreceta' : 'Receta'}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{formatYield(recipe)}</td>
                  <td className="px-4 py-2">
                    {cost?.is_complete && cost.total_cost != null ? (
                      `${cost.total_cost.toFixed(2)} €`
                    ) : (
                      <span className="text-amber-600" title={cost?.missing_reasons?.join(' ') ?? undefined}>
                        Coste incompleto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {cost?.is_complete && cost.unit_cost != null ? (
                      `${cost.unit_cost.toFixed(4)} €`
                    ) : cost?.is_complete ? (
                      <span className="text-amber-600" title="Falta definir el rendimiento">
                        —
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  No hay recetas que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
