// Ayudas de presentación compartidas entre las pantallas de recetas —
// ninguna cambia ningún cálculo, solo cómo se muestra lo que ya calculó el
// motor de costes (en SQL) o lo que ya trae la receta.
import type { Recipe } from '@/types'

export function formatYield(recipe: Pick<Recipe, 'yield_quantity' | 'yield_unit'>) {
  if (recipe.yield_quantity == null || !recipe.yield_unit) return '—'
  return `${recipe.yield_quantity} ${recipe.yield_unit}`
}

// Un ingrediente o receta puede borrarse mientras sigue referenciado desde
// un componente/producción viejo — este texto es el mismo en toda la app,
// aquí en un solo sitio para que no se desvíe entre pantallas.
export const INGREDIENT_DELETED_LABEL = 'Ingrediente eliminado'
export const RECIPE_DELETED_LABEL = 'Receta eliminada'
