import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { CocinaView } from '@/features/recipes/views/CocinaView'
import { CostesView } from '@/features/recipes/views/CostesView'
import { ProducirView } from '@/features/recipes/views/ProducirView'
import { CompletaView } from '@/features/recipes/views/CompletaView'
import type { Ingredient, Recipe, RecipeComponent, RecipeComponentCost, RecipeCost } from '@/types'

type Tab = 'cocina' | 'costes' | 'producir' | 'completa'

export function RecipeViewPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [components, setComponents] = useState<RecipeComponent[]>([])
  const [ingredientNames, setIngredientNames] = useState<Record<string, string>>({})
  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({})
  const [cost, setCost] = useState<RecipeCost | null>(null)
  const [componentCosts, setComponentCosts] = useState<RecipeComponentCost[]>([])
  const [tab, setTab] = useState<Tab>('cocina')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void loadAll(id)
  }, [id, isAdmin])

  async function loadAll(recipeId: string) {
    setLoading(true)

    const [{ data: recipeData }, { data: compsData }, { data: ingredientsData }, { data: recipesData }] =
      await Promise.all([
        supabase.from('recipes').select('*').eq('id', recipeId).single(),
        supabase.from('recipe_components').select('*').eq('recipe_id', recipeId).order('position'),
        supabase.from('ingredients').select('*'),
        supabase.from('recipes').select('id, name'),
      ])

    setRecipe((recipeData as Recipe) ?? null)
    setComponents((compsData as RecipeComponent[]) ?? [])

    const ingMap: Record<string, string> = {}
    for (const ing of (ingredientsData as Ingredient[]) ?? []) ingMap[ing.id] = ing.name
    setIngredientNames(ingMap)

    const recMap: Record<string, string> = {}
    for (const rec of (recipesData as { id: string; name: string }[]) ?? []) recMap[rec.id] = rec.name
    setRecipeNames(recMap)

    if (isAdmin) {
      const [{ data: costData }, { data: componentCostsData }] = await Promise.all([
        supabase.from('recipe_costs').select('*').eq('recipe_id', recipeId).single(),
        supabase.rpc('get_recipe_component_costs', { p_recipe_id: recipeId }),
      ])
      setCost((costData as RecipeCost) ?? null)
      setComponentCosts((componentCostsData as RecipeComponentCost[]) ?? [])
    }

    setLoading(false)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  if (!recipe) {
    return <p className="text-neutral-500">Receta no encontrada.</p>
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">{recipe.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Rendimiento: {recipe.yield_quantity != null ? `${recipe.yield_quantity} ${recipe.yield_unit}` : '—'}
            {isAdmin && (
              <>
                {' · '}
                Coste: {cost?.total_cost != null ? `${cost.total_cost.toFixed(2)} €` : 'incompleto'}
              </>
            )}
            {' · '}
            {recipe.status === 'active' ? 'Activa' : 'Archivada'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/recetas/${recipe.id}/editar`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="mt-4 hidden print:block">
        <h1 className="text-2xl font-semibold">{recipe.name}</h1>
        <p className="text-sm text-neutral-600">
          Rendimiento: {recipe.yield_quantity != null ? `${recipe.yield_quantity} ${recipe.yield_unit}` : '—'}
        </p>
      </div>

      <div className="mt-4 flex gap-1 border-b border-neutral-200 print:hidden">
        <button
          type="button"
          onClick={() => setTab('cocina')}
          className={`px-3 py-2 text-sm font-medium ${tab === 'cocina' ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500'}`}
        >
          Cocina
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTab('costes')}
            className={`px-3 py-2 text-sm font-medium ${tab === 'costes' ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500'}`}
          >
            Costes
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('producir')}
          className={`px-3 py-2 text-sm font-medium ${tab === 'producir' ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500'}`}
        >
          Producir
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTab('completa')}
            className={`px-3 py-2 text-sm font-medium ${tab === 'completa' ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500'}`}
          >
            Completa
          </button>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 print:border-0 print:p-0">
        {tab === 'cocina' && (
          <CocinaView
            recipe={recipe}
            components={components}
            ingredientNames={ingredientNames}
            recipeNames={recipeNames}
          />
        )}
        {tab === 'costes' && isAdmin && <CostesView cost={cost} componentCosts={componentCosts} />}
        {tab === 'producir' && <ProducirView recipe={recipe} />}
        {tab === 'completa' && isAdmin && (
          <CompletaView
            recipe={recipe}
            components={components}
            ingredientNames={ingredientNames}
            recipeNames={recipeNames}
            cost={cost}
            componentCosts={componentCosts}
          />
        )}
      </div>
    </div>
  )
}
