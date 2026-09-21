import type { RecipeComponent, Unit } from '@/types'

const BASE: Partial<Record<Unit, { family: 'mass' | 'volume'; factor: number }>> = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  L: { family: 'volume', factor: 1000 },
}

// Tolerancia relativa: por debajo de esto no se avisa (redondeos).
const TOLERANCE = 0.02

export type YieldMismatch = { sum: number; unit: Unit }

// Compara el rendimiento escrito con la suma de los componentes. Solo opina
// cuando la comparación es honesta: todos los componentes son ingredientes
// (una subreceta no tiene peso conocido aquí) y todos están en la misma
// familia (masa o volumen) que el rendimiento. Si no, devuelve null.
export function yieldMismatch(
  components: Pick<RecipeComponent, 'component_type' | 'quantity' | 'unit'>[],
  yieldQuantity: number,
  yieldUnit: Unit,
): YieldMismatch | null {
  const target = BASE[yieldUnit]
  if (!target || !(yieldQuantity > 0) || components.length === 0) return null

  let sumBase = 0
  for (const c of components) {
    const b = BASE[c.unit]
    if (c.component_type !== 'ingredient' || !b || b.family !== target.family) return null
    sumBase += c.quantity * b.factor
  }

  const sum = sumBase / target.factor
  if (Math.abs(sum - yieldQuantity) / yieldQuantity <= TOLERANCE) return null
  return { sum: Math.round(sum * 100) / 100, unit: yieldUnit }
}
