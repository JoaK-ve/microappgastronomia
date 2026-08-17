import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { Ingredient, Recipe, RecipeComponent, RecipeComponentType, RecipeCost, Unit } from '@/types'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'ud']

export function RecipeComponentsSection({ recipeId, businessId }: { recipeId: string; businessId: string }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [components, setComponents] = useState<RecipeComponent[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [cost, setCost] = useState<RecipeCost | null>(null)

  const [componentType, setComponentType] = useState<RecipeComponentType>('ingredient')
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<Unit>('g')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  }, [recipeId, isAdmin])

  async function loadAll() {
    const [{ data: comps }, { data: ings }, { data: recs }] = await Promise.all([
      supabase.from('recipe_components').select('*').eq('recipe_id', recipeId).order('position'),
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('recipes').select('*').neq('id', recipeId).order('name'),
    ])
    setComponents((comps as RecipeComponent[]) ?? [])
    setIngredients((ings as Ingredient[]) ?? [])
    setRecipes((recs as Recipe[]) ?? [])

    if (isAdmin) {
      const { data: costData } = await supabase.from('recipe_costs').select('*').eq('recipe_id', recipeId).single()
      setCost((costData as RecipeCost) ?? null)
    }
  }

  function displayName(component: RecipeComponent) {
    if (component.component_type === 'ingredient') {
      return ingredients.find((i) => i.id === component.ingredient_id)?.name ?? 'Ingrediente eliminado'
    }
    return recipes.find((r) => r.id === component.component_recipe_id)?.name ?? 'Receta eliminada'
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!selectedId) {
      setError('Elige un ingrediente o receta.')
      return
    }

    const payload = {
      business_id: businessId,
      recipe_id: recipeId,
      component_type: componentType,
      ingredient_id: componentType === 'ingredient' ? selectedId : null,
      component_recipe_id: componentType === 'recipe' ? selectedId : null,
      quantity: Number(quantity),
      unit,
      position: components.length,
    }

    const { error: insertError } = await supabase.from('recipe_components').insert(payload)

    if (insertError) {
      setError(
        insertError.message.includes('circular')
          ? insertError.message
          : 'No se pudo añadir el componente.',
      )
      return
    }

    setSelectedId('')
    setQuantity('')
    void loadAll()
  }

  async function handleDelete(id: string) {
    await supabase.from('recipe_components').delete().eq('id', id)
    void loadAll()
  }

  const options = componentType === 'ingredient' ? ingredients : recipes

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-medium">Componentes</h2>
      <p className="mt-1 text-sm text-neutral-500">Un componente es un ingrediente o una receta (subreceta).</p>

      {isAdmin && cost && (
        <div className="mt-3 space-y-1 rounded-md bg-neutral-50 px-3 py-2 text-sm">
          {cost.is_complete && cost.total_cost != null ? (
            <p>
              Coste total: <strong>{cost.total_cost.toFixed(2)} €</strong>
              {cost.unit_cost != null ? (
                <>
                  {' '}
                  — Coste por unidad de rendimiento: <strong>{cost.unit_cost.toFixed(4)} €</strong>
                </>
              ) : (
                <span className="text-amber-600">
                  {' '}
                  — Coste unitario: — (falta definir el rendimiento para calcularlo)
                </span>
              )}
            </p>
          ) : (
            <div>
              <p className="font-medium text-amber-600">Coste incompleto</p>
              <ul className="list-disc pl-5 text-amber-600">
                {cost.missing_reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {components.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-100">
          {components.map((component) => (
            <li key={component.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {displayName(component)} — {component.quantity} {component.unit}
                {component.component_type === 'recipe' && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    receta
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(component.id)}
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

        <select
          value={componentType}
          onChange={(event) => {
            setComponentType(event.target.value as RecipeComponentType)
            setSelectedId('')
          }}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="ingredient">Ingrediente</option>
          <option value="recipe">Receta</option>
        </select>

        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          required
          className="min-w-[10rem] flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            {componentType === 'ingredient' ? 'Elige un ingrediente' : 'Elige una receta'}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

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
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
          Añadir
        </button>
      </form>
    </section>
  )
}
