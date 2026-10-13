// Ayudas de presentación compartidas entre las pantallas de recetas —
// ninguna cambia ningún cálculo, solo cómo se muestra lo que ya calculó el
// motor de costes (en SQL) o lo que ya trae la receta.
import { supabase } from '@/lib/supabase'
import type { Recipe, RecipeCost } from '@/types'

export function formatYield(recipe: Pick<Recipe, 'yield_quantity' | 'yield_unit'>) {
  if (recipe.yield_quantity == null || !recipe.yield_unit) return '—'
  return `${recipe.yield_quantity} ${recipe.yield_unit}`
}

// Un ingrediente o receta puede borrarse mientras sigue referenciado desde
// un componente/producción viejo — este texto es el mismo en toda la app,
// aquí en un solo sitio para que no se desvíe entre pantallas.
export const INGREDIENT_DELETED_LABEL = 'Ingrediente eliminado'
export const RECIPE_DELETED_LABEL = 'Receta eliminada'

// Al añadir o editar un componente de receta, la base de datos puede
// rechazarlo por crear un ciclo entre subrecetas (trigger
// trg_recipe_components_no_cycle) — ese mensaje sí es útil mostrarlo tal
// cual. Cualquier otro error usa el mensaje genérico que pase cada pantalla
// (es distinto según si fue un alta o una edición).
export function componentErrorMessage(error: { message: string } | null | undefined, fallback: string) {
  return error?.message.includes('circular') ? error.message : fallback
}

// La consulta del coste de una receta estaba repetida igual (consulta +
// resultado "nulo" cuando no es admin) en RecipeComponentsSection y
// BakeryComponentsSection — ambas la meten en su propio Promise.all junto
// con el resto de sus consultas (ver V1.11.5), así que esto solo devuelve
// la promesa, no hace su propio fetch aparte.
export function recipeCostQuery(recipeId: string, isAdmin: boolean) {
  return isAdmin
    ? supabase.from('recipe_costs').select('*').eq('recipe_id', recipeId).single()
    : Promise.resolve({ data: null as RecipeCost | null })
}
