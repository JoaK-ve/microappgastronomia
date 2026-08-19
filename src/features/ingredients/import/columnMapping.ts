import { normalizeText } from '@/features/ingredients/import/unitMapping'
import type { ColumnMapping, TargetField } from '@/features/ingredients/import/types'

const KEYWORDS: Record<TargetField, string[]> = {
  name: ['ingrediente', 'nombre', 'producto', 'articulo', 'descripcion producto', 'item'],
  category: ['categoria', 'familia', 'tipo', 'grupo'],
  unit: ['unidad', 'ud', 'u.m.', 'um', 'medida', 'unidad de medida', 'unidad de uso'],
  price: ['precio', 'coste', 'costo', 'p. compra', 'precio compra', 'coste compra', 'importe', 'p compra'],
  quantity: ['cantidad', 'contenido', 'formato', 'presentacion', 'cantidad de compra'],
  purchaseDescription: ['envase', 'formato de compra', 'presentacion compra', 'descripcion compra'],
}

const FIELD_PRIORITY: TargetField[] = ['name', 'unit', 'price', 'category', 'quantity', 'purchaseDescription']

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((h) => normalizeText(h))
  const mapping: ColumnMapping = {
    name: null,
    category: null,
    unit: null,
    price: null,
    quantity: null,
    purchaseDescription: null,
  }
  const usedColumns = new Set<number>()

  for (const field of FIELD_PRIORITY) {
    const keywords = KEYWORDS[field]
    let bestIndex = -1

    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedColumns.has(i)) continue
      if (keywords.includes(normalizedHeaders[i])) {
        bestIndex = i
        break
      }
    }

    if (bestIndex === -1) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (usedColumns.has(i)) continue
        if (keywords.some((kw) => normalizedHeaders[i].includes(kw))) {
          bestIndex = i
          break
        }
      }
    }

    if (bestIndex !== -1) {
      mapping[field] = bestIndex
      usedColumns.add(bestIndex)
    }
  }

  return mapping
}
