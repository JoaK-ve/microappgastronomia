// Cómo se ve el coste cuando falta un dato (precio de un ingrediente,
// equivalencia, etc.) — antes cada pantalla lo escribía a su manera y la
// redacción ya había empezado a desviarse ("Incompleto" / "Coste
// incompleto" / "Food cost incompleto"). Dos formas, según el espacio:
// una insignia chica para celdas de tabla, y un aviso con la lista de
// motivos para las pantallas de detalle.

export function CostIncompleteBadge({ missingReasons }: { missingReasons: string[] }) {
  return (
    <span className="text-amber-600" title={missingReasons.join(' ')}>
      Incompleto
    </span>
  )
}

export function CostIncompleteNotice({
  label = 'Coste',
  missingReasons,
}: {
  label?: string
  missingReasons: string[]
}) {
  return (
    <div>
      <p className="font-medium text-amber-600">{label} incompleto</p>
      <ul className="mt-1 list-disc pl-5 text-amber-600">
        {missingReasons.map((reason, index) => (
          <li key={index}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}
