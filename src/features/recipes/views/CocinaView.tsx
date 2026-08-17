import type { Recipe, RecipeComponent } from '@/types'

function componentName(
  component: RecipeComponent,
  ingredientNames: Record<string, string>,
  recipeNames: Record<string, string>,
) {
  if (component.component_type === 'ingredient') {
    return ingredientNames[component.ingredient_id ?? ''] ?? 'Ingrediente eliminado'
  }
  return recipeNames[component.component_recipe_id ?? ''] ?? 'Receta eliminada'
}

export function CocinaView({
  recipe,
  components,
  ingredientNames,
  recipeNames,
}: {
  recipe: Recipe
  components: RecipeComponent[]
  ingredientNames: Record<string, string>
  recipeNames: Record<string, string>
}) {
  return (
    <div className="space-y-6 print:space-y-4">
      <section>
        <h2 className="text-lg font-medium">Ingredientes</h2>
        {components.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Esta receta no tiene componentes todavía.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {components.map((component) => (
              <li key={component.id} className="flex justify-between border-b border-neutral-100 py-1.5">
                <span>
                  {componentName(component, ingredientNames, recipeNames)}
                  {component.component_type === 'recipe' && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 print:hidden">
                      receta
                    </span>
                  )}
                </span>
                <span className="font-medium">
                  {component.quantity} {component.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">Elaboración</h2>
        {recipe.steps.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Sin pasos definidos.</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">Rendimiento</h2>
        <p className="mt-2 text-sm">
          {recipe.yield_quantity != null ? `${recipe.yield_quantity} ${recipe.yield_unit}` : '—'}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium">Conservación</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Método</dt>
            <dd>{recipe.conservation_method || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Temperatura</dt>
            <dd>{recipe.conservation_temperature || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Vida útil</dt>
            <dd>{recipe.conservation_shelf_life || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Observaciones</dt>
            <dd>{recipe.conservation_notes || '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
