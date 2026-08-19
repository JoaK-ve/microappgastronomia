import type { Unit } from '@/types'

export type RawTable = {
  headers: string[]
  rows: string[][]
}

export type ParsedSource = {
  sheets: { name: string; table: RawTable }[]
  warning: string | null
}

export type TargetField = 'name' | 'category' | 'unit' | 'price' | 'quantity' | 'purchaseDescription'

export type ColumnMapping = Record<TargetField, number | null>

export type ImportRowStatus = 'new' | 'existing' | 'possible_duplicate' | 'update' | 'error' | 'ignored'

export type ImportRowAction = 'create' | 'update_price' | 'ignore'

export type ImportRow = {
  clientId: string
  rowIndex: number
  name: string
  category: string | null
  usageUnitRaw: string
  usageUnit: Unit | null
  priceRaw: string | null
  price: number | null
  quantityRaw: string | null
  quantity: number | null
  purchaseDescription: string
  status: ImportRowStatus
  errors: string[]
  matchedIngredientId: string | null
  matchedIngredientName: string | null
  action: ImportRowAction
}

export const TARGET_FIELD_LABEL: Record<TargetField, string> = {
  name: 'Nombre',
  category: 'Categoría',
  unit: 'Unidad',
  price: 'Precio',
  quantity: 'Cantidad de compra',
  purchaseDescription: 'Descripción de compra',
}
