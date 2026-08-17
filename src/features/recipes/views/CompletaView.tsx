import { CocinaView } from '@/features/recipes/views/CocinaView'
import { CostesView } from '@/features/recipes/views/CostesView'
import type { Recipe, RecipeComponent, RecipeComponentCost, RecipeCost } from '@/types'

export function CompletaView({
  recipe,
  components,
  ingredientNames,
  recipeNames,
  cost,
  componentCosts,
}: {
  recipe: Recipe
  components: RecipeComponent[]
  ingredientNames: Record<string, string>
  recipeNames: Record<string, string>
  cost: RecipeCost | null
  componentCosts: RecipeComponentCost[]
}) {
  return (
    <div className="space-y-6 print:space-y-4">
      <section>
        <h2 className="text-lg font-medium">Identificación</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Nombre</dt>
            <dd>{recipe.name}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Categoría</dt>
            <dd>{recipe.category || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Código</dt>
            <dd>{recipe.code || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Estado</dt>
            <dd>{recipe.status === 'active' ? 'Activa' : 'Archivada'}</dd>
          </div>
        </dl>
      </section>

      {/* Componentes, elaboración, rendimiento y conservación: misma vista que Cocina, sin duplicar. */}
      <CocinaView
        recipe={recipe}
        components={components}
        ingredientNames={ingredientNames}
        recipeNames={recipeNames}
      />

      {/* Información económica: misma vista que Costes, sin duplicar. */}
      <CostesView cost={cost} componentCosts={componentCosts} />

      <section>
        <h2 className="text-lg font-medium">Información interna</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Versión</dt>
            <dd>{recipe.version}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Creada</dt>
            <dd>{new Date(recipe.created_at).toLocaleDateString('es-ES')}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Última modificación</dt>
            <dd>{new Date(recipe.updated_at).toLocaleDateString('es-ES')}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
