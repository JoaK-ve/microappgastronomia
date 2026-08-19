import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CocinaView } from '@/features/recipes/views/CocinaView'
import { CostesView } from '@/features/recipes/views/CostesView'
import { ProducirView } from '@/features/recipes/views/ProducirView'
import { CompletaView } from '@/features/recipes/views/CompletaView'
import type {
  Ingredient,
  Recipe,
  RecipeComponent,
  RecipeComponentCost,
  RecipeCost,
  RecipeDeleteBlockers,
} from '@/types'

type Tab = 'cocina' | 'costes' | 'producir' | 'completa'

export function RecipeViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [deleteState, setDeleteState] = useState<'idle' | 'checking' | 'blocked' | 'confirm' | 'deleting'>('idle')
  const [deleteBlockers, setDeleteBlockers] = useState<RecipeDeleteBlockers | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  async function handleDeleteClick() {
    if (!recipe) return
    setDeleteState('checking')
    setDeleteError(null)

    const { data, error: checkError } = await supabase
      .rpc('get_recipe_delete_blockers', { p_recipe_id: recipe.id })
      .single()

    if (checkError || !data) {
      setDeleteError('No se pudo comprobar las dependencias de la receta. Inténtalo de nuevo.')
      setDeleteState('idle')
      return
    }

    const blockers = data as RecipeDeleteBlockers
    setDeleteBlockers(blockers)
    setDeleteState(blockers.used_as_subrecipe_count > 0 || blockers.production_count > 0 ? 'blocked' : 'confirm')
  }

  async function handleDeleteConfirm() {
    if (!recipe) return
    setDeleteState('deleting')
    setDeleteError(null)

    const { error: deleteRequestError } = await supabase.from('recipes').delete().eq('id', recipe.id)

    if (deleteRequestError) {
      setDeleteError(
        'No se pudo eliminar la receta. Puede que se haya empezado a usar como subreceta o producido justo ahora — recarga la página e inténtalo de nuevo.',
      )
      setDeleteState('confirm')
      return
    }

    navigate('/recetas', { replace: true })
  }

  function handleDeleteCancel() {
    setDeleteState('idle')
    setDeleteError(null)
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
          {isAdmin && (
            <button
              type="button"
              onClick={() => void handleDeleteClick()}
              disabled={deleteState === 'checking'}
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              {deleteState === 'checking' ? 'Comprobando…' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteState === 'blocked' || deleteState === 'confirm' || deleteState === 'deleting'}
        title={deleteState === 'blocked' ? 'No se puede eliminar' : 'Eliminar receta'}
        description={
          deleteState === 'blocked' && deleteBlockers ? (
            <div className="space-y-2">
              {deleteBlockers.used_as_subrecipe_count > 0 && (
                <div>
                  <p>
                    Esta receta no puede eliminarse porque está siendo utilizada como subreceta en{' '}
                    {deleteBlockers.used_as_subrecipe_count} receta
                    {deleteBlockers.used_as_subrecipe_count === 1 ? '' : 's'}:
                  </p>
                  <ul className="mt-2 list-disc pl-5">
                    {deleteBlockers.used_as_subrecipe_names.map((recipeName) => (
                      <li key={recipeName}>{recipeName}</li>
                    ))}
                  </ul>
                </div>
              )}
              {deleteBlockers.production_count > 0 && (
                <p>
                  Esta receta tiene {deleteBlockers.production_count} producción
                  {deleteBlockers.production_count === 1 ? '' : 'es'} registrada
                  {deleteBlockers.production_count === 1 ? '' : 's'} y no puede eliminarse porque se perdería el
                  historial.
                </p>
              )}
            </div>
          ) : (
            <p>
              ¿Quieres eliminar &quot;{recipe.name}&quot;? Esta acción no se puede deshacer.
            </p>
          )
        }
        onConfirm={deleteState === 'blocked' ? undefined : () => void handleDeleteConfirm()}
        onCancel={handleDeleteCancel}
        loading={deleteState === 'deleting'}
        error={deleteError}
      />

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
