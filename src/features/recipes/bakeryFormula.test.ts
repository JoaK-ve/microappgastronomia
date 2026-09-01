import { describe, expect, it } from 'vitest'
import { flourGramsFrom, gramsForRow } from '@/features/recipes/bakeryFormula'

// Datos reales de "Pan Blanco de Aceitunas" (hoja de cálculo de La
// Esquina Caliente): Paston 570g × Cantidad 2 = 1140g de masa total.
const ROWS = [
  { flour_percent: 90 }, // Harina Heredia (harina base)
  { flour_percent: 10 }, // H. La Estampa (harina base)
  { flour_percent: 50 }, // Agua
  { flour_percent: 2 }, // Levadura fresca
  { flour_percent: 2 }, // Sal
  { flour_percent: 20 }, // Masa Madre
  { flour_percent: 15 }, // Mix Aceitunas
  { flour_percent: 0.5 }, // Orégano
]
const TOTAL_DOUGH = 570 * 2 // 1140g — Paston × Cantidad = masa TOTAL, no solo harina.

describe('flourGramsFrom', () => {
  it('saca el peso de la harina por regla de tres usando la suma de TODOS los %, no solo los marcados harina base', () => {
    const result = flourGramsFrom(ROWS, TOTAL_DOUGH)
    expect(result).not.toBeNull()
    // totalPercent = 189.5 → flourGrams = 1140 / 1.895
    expect(result!.totalPercent).toBeCloseTo(189.5, 5)
    expect(result!.flourGrams).toBeCloseTo(601.58, 1)
  })

  it('reproduce exactos los gramos reales de la hoja de cálculo original para cada ingrediente', () => {
    const { flourGrams } = flourGramsFrom(ROWS, TOTAL_DOUGH)!
    const expected = [541.4, 60.2, 300.8, 12.0, 12.0, 120.3, 90.2, 3.0]
    ROWS.forEach((row, i) => {
      expect(gramsForRow(row.flour_percent, flourGrams)).toBeCloseTo(expected[i], 1)
    })
  })

  it('la suma de los gramos de todas las filas da exactamente el peso total de la masa (Paston × Cantidad)', () => {
    const { flourGrams } = flourGramsFrom(ROWS, TOTAL_DOUGH)!
    const total = ROWS.reduce((sum, row) => sum + gramsForRow(row.flour_percent, flourGrams), 0)
    expect(total).toBeCloseTo(TOTAL_DOUGH, 5)
  })

  it('devuelve null si no hay masa total o no hay ningún % cargado', () => {
    expect(flourGramsFrom(ROWS, 0)).toBeNull()
    expect(flourGramsFrom([], TOTAL_DOUGH)).toBeNull()
  })

  it('caso simple: una sola fila de harina al 100% — la harina ES toda la masa', () => {
    const result = flourGramsFrom([{ flour_percent: 100 }], 1000)
    expect(result!.flourGrams).toBeCloseTo(1000, 5)
  })
})
