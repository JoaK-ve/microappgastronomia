import type { RecipeComponentCost, RecipeCost } from '@/types'

export function CostesView({
  cost,
  componentCosts,
}: {
  cost: RecipeCost | null
  componentCosts: RecipeComponentCost[]
}) {
  return (
    <div className="space-y-6 print:space-y-4">
      <section>
        <h2 className="text-lg font-medium">Escandallo</h2>
        {componentCosts.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Esta receta no tiene componentes todavía.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4 font-medium">Componente</th>
                <th className="py-2 pr-4 font-medium">Cantidad</th>
                <th className="py-2 pr-4 font-medium">Coste unitario</th>
                <th className="py-2 font-medium">Coste componente</th>
              </tr>
            </thead>
            <tbody>
              {componentCosts.map((component) => (
                <tr key={component.component_id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-4">{component.name}</td>
                  <td className="py-2 pr-4 text-neutral-600">
                    {component.quantity} {component.unit}
                  </td>
                  <td className="py-2 pr-4 text-neutral-600">
                    {component.unit_cost != null ? `${component.unit_cost.toFixed(4)} €` : '—'}
                  </td>
                  <td className="py-2">
                    {component.component_cost != null ? (
                      `${component.component_cost.toFixed(2)} €`
                    ) : (
                      <span className="text-amber-600" title={component.missing_reason ?? undefined}>
                        Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-md bg-neutral-50 px-3 py-3 text-sm print:bg-transparent print:px-0">
        {cost?.is_complete && cost.total_cost != null ? (
          <div className="space-y-1">
            <p>
              Coste total: <strong>{cost.total_cost.toFixed(2)} €</strong>
            </p>
            <p>
              Coste por unidad de rendimiento:{' '}
              {cost.unit_cost != null ? (
                <strong>{cost.unit_cost.toFixed(4)} €</strong>
              ) : (
                <span className="text-amber-600">— (falta definir el rendimiento)</span>
              )}
            </p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-amber-600">Coste incompleto</p>
            <ul className="mt-1 list-disc pl-5 text-amber-600">
              {(cost?.missing_reasons ?? []).map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
