import type { Ingredient } from '@/types'
import { fuzzyIngredientKey, mapUnit, normalizeIngredientName, parsePrice } from '@/features/ingredients/import/unitMapping'
import type { ColumnMapping, ImportRow, RawTable } from '@/features/ingredients/import/types'

export type NameMatchIndex = {
  byExactName: Map<string, Ingredient>
  byNormalizedName: Map<string, Ingredient>
  byFuzzyKey: Map<string, Ingredient>
}

export function buildNameMatchIndex(existingIngredients: Ingredient[]): NameMatchIndex {
  const byExactName = new Map<string, Ingredient>()
  const byNormalizedName = new Map<string, Ingredient>()
  const byFuzzyKey = new Map<string, Ingredient>()
  for (const ingredient of existingIngredients) {
    // Coincidencia EXACTA = mismo texto literal (solo se recortan espacios de
    // borde). Cualquier otra coincidencia — mayúsculas/minúsculas, acentos,
    // espacios internos, preposiciones/orden de palabras — es ambigua y se
    // trata como POSIBLE DUPLICADO, nunca se fusiona sola (sección 8 de la
    // tarea, ejemplos "Tomate"/"tomate" y "Aceite de oliva"/"Aceite Oliva").
    byExactName.set(ingredient.name.trim(), ingredient)
    const normalized = normalizeIngredientName(ingredient.name)
    if (!byNormalizedName.has(normalized)) byNormalizedName.set(normalized, ingredient)
    const fuzzyKey = fuzzyIngredientKey(ingredient.name)
    if (fuzzyKey && !byFuzzyKey.has(fuzzyKey)) byFuzzyKey.set(fuzzyKey, ingredient)
  }
  return { byExactName, byNormalizedName, byFuzzyKey }
}

function cell(row: string[], index: number | null): string {
  if (index == null) return ''
  return (row[index] ?? '').trim()
}

export type RawFields = {
  name: string
  category: string | null
  usageUnitRaw: string
  priceRaw: string | null
  quantityRaw: string | null
  purchaseDescriptionMapped: string
}

export function evaluateRow(clientId: string, rowIndex: number, fields: RawFields, index: NameMatchIndex): ImportRow {
  const { name, category, usageUnitRaw, priceRaw, quantityRaw, purchaseDescriptionMapped } = fields
  const errors: string[] = []

  if (!name) errors.push('Nombre vacío.')

  const usageUnit = usageUnitRaw ? mapUnit(usageUnitRaw) : null
  if (usageUnitRaw && !usageUnit) errors.push(`Unidad "${usageUnitRaw}" no reconocida.`)
  if (!usageUnitRaw) errors.push('Unidad vacía.')

  let price: number | null = null
  if (priceRaw) {
    price = parsePrice(priceRaw)
    if (price == null) errors.push(`Precio "${priceRaw}" no es válido.`)
    else if (price < 0) errors.push('El precio no puede ser negativo.')
  }

  let quantity: number | null = null
  if (quantityRaw) {
    quantity = parsePrice(quantityRaw)
    if (quantity == null || quantity <= 0) {
      errors.push(`Cantidad de compra "${quantityRaw}" no es válida.`)
      quantity = null
    }
  } else if (price != null) {
    quantity = 1
  }

  const purchaseDescription = purchaseDescriptionMapped || (price != null ? 'Importado' : '')

  let matchedIngredientId: string | null = null
  let matchedIngredientName: string | null = null
  let status: ImportRow['status'] = 'new'
  let action: ImportRow['action'] = 'create'

  if (name) {
    const exact = index.byExactName.get(name.trim())
    if (exact) {
      matchedIngredientId = exact.id
      matchedIngredientName = exact.name
      status = price != null ? 'update' : 'existing'
      action = price != null ? 'update_price' : 'ignore'
    } else {
      const normalized = normalizeIngredientName(name)
      const fuzzy = index.byNormalizedName.get(normalized) ?? index.byFuzzyKey.get(fuzzyIngredientKey(name))
      if (fuzzy) {
        matchedIngredientId = fuzzy.id
        matchedIngredientName = fuzzy.name
        status = 'possible_duplicate'
        action = 'ignore'
      }
    }
  }

  if (errors.length > 0) {
    status = 'error'
    action = 'ignore'
  }

  return {
    clientId,
    rowIndex,
    name,
    category,
    usageUnitRaw,
    usageUnit,
    priceRaw,
    price,
    quantityRaw,
    quantity,
    purchaseDescription,
    status,
    errors,
    matchedIngredientId,
    matchedIngredientName,
    action,
  }
}

export function buildImportRows(
  table: RawTable,
  mapping: ColumnMapping,
  existingIngredients: Ingredient[],
): ImportRow[] {
  const index = buildNameMatchIndex(existingIngredients)

  return table.rows.map((rawRow, i) => {
    const isEmptyRow = rawRow.every((c) => c.trim() === '')
    if (isEmptyRow) {
      return {
        clientId: `row-${i}`,
        rowIndex: i,
        name: '',
        category: null,
        usageUnitRaw: '',
        usageUnit: null,
        priceRaw: null,
        price: null,
        quantityRaw: null,
        quantity: null,
        purchaseDescription: '',
        status: 'ignored',
        errors: [],
        matchedIngredientId: null,
        matchedIngredientName: null,
        action: 'ignore',
      }
    }

    return evaluateRow(
      `row-${i}`,
      i,
      {
        name: cell(rawRow, mapping.name),
        category: cell(rawRow, mapping.category) || null,
        usageUnitRaw: cell(rawRow, mapping.unit),
        priceRaw: cell(rawRow, mapping.price) || null,
        quantityRaw: cell(rawRow, mapping.quantity) || null,
        purchaseDescriptionMapped: cell(rawRow, mapping.purchaseDescription),
      },
      index,
    )
  })
}
