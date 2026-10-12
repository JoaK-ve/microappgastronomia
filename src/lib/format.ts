// Formato de dinero compartido — toda la app muestra precios/costes en
// euros, con 2 decimales para totales/precios normales y 4 para costes por
// unidad de uso (que suelen ser céntimos muy chicos, ej. 0,0020 €/g).
export function formatCurrency(value: number, decimals: 2 | 4 = 2) {
  return `${value.toFixed(decimals)} €`
}
