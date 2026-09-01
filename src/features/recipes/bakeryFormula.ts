// Fórmula panadera (porcentaje panadero): la harina es la base 100%
// (puede repartirse entre varias filas marcadas "harina base" — su suma
// debe dar 100). El resto de ingredientes son % de ese mismo peso de
// harina. Paston (peso por pieza) × Cantidad (piezas) = peso TOTAL de la
// masa — la suma de TODOS los ingredientes, no solo la harina.
//
// Para sacar el peso de la harina se usa una regla de tres con la suma de
// TODOS los % (no solo los marcados "harina base"): si el 100% de la
// harina más el resto de ingredientes suman totalPercent%, y ese conjunto
// pesa totalDough gramos en total, entonces:
//   flourGrams = totalDough / (totalPercent / 100)
// y cada fila: gramos = flour_percent / 100 × flourGrams.
//
// Extraído a un módulo aparte (en vez de vivir solo dentro del
// componente) para poder probarlo con datos reales sin tener que montar
// el componente — un bug real de esta fórmula (confundir "harina" con
// "masa total" en el denominador) se coló a producción antes de tener
// este test.

export function flourGramsFrom(rows: { flour_percent: number | null }[], totalDough: number) {
  const totalPercent = rows.reduce((sum, r) => sum + (r.flour_percent ?? 0), 0)
  if (!totalPercent || !totalDough) return null
  return { flourGrams: totalDough / (totalPercent / 100), totalPercent }
}

export function gramsForRow(percent: number | null, flourGrams: number) {
  return ((percent ?? 0) / 100) * flourGrams
}
