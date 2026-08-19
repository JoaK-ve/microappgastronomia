import { describe, expect, it } from 'vitest'
import { buildImportRows } from '@/features/ingredients/import/buildRows'
import type { RawTable } from '@/features/ingredients/import/types'
import type { Ingredient } from '@/types'

const mapping = { name: 0, unit: 1, price: 2, category: null, quantity: null, purchaseDescription: null }

function ingredient(overrides: Partial<Ingredient>): Ingredient {
  return {
    id: crypto.randomUUID(),
    business_id: 'biz-1',
    name: 'Sal',
    category: null,
    usage_unit: 'kg',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildImportRows', () => {
  it('marca como NUEVO un ingrediente sin coincidencia', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['Tomate', 'kg', '1,80']] }
    const [row] = buildImportRows(table, mapping, [])
    expect(row.status).toBe('new')
    expect(row.action).toBe('create')
    expect(row.usageUnit).toBe('kg')
    expect(row.price).toBeCloseTo(1.8)
    expect(row.quantity).toBe(1)
  })

  it('marca como EXISTENTE cuando el nombre coincide exactamente y no hay precio', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['Sal', 'kg', '']] }
    const existing = [ingredient({ name: 'Sal' })]
    const [row] = buildImportRows(table, mapping, existing)
    expect(row.status).toBe('existing')
    expect(row.action).toBe('ignore')
    expect(row.matchedIngredientId).toBe(existing[0].id)
  })

  it('marca como ACTUALIZAR cuando el nombre coincide exactamente y hay precio', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['Aceite', 'l', '4,90']] }
    const existing = [ingredient({ name: 'Aceite', usage_unit: 'L' })]
    const [row] = buildImportRows(table, mapping, existing)
    expect(row.status).toBe('update')
    expect(row.action).toBe('update_price')
  })

  it('marca como POSIBLE DUPLICADO cuando el nombre difiere solo en mayúsculas', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['tomate', 'kg', '']] }
    const existing = [ingredient({ name: 'Tomate' })]
    const [row] = buildImportRows(table, mapping, existing)
    expect(row.status).toBe('possible_duplicate')
    expect(row.action).toBe('ignore')
  })

  it('marca como POSIBLE DUPLICADO nombres normalizados equivalentes', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['Aceite Oliva', 'l', '']] }
    const existing = [ingredient({ name: 'Aceite de oliva', usage_unit: 'L' })]
    const [row] = buildImportRows(table, mapping, existing)
    expect(row.status).toBe('possible_duplicate')
  })

  it('nunca fusiona automáticamente un posible duplicado', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['tomate', 'kg', '2,00']] }
    const existing = [ingredient({ name: 'Tomate' })]
    const [row] = buildImportRows(table, mapping, existing)
    expect(row.action).not.toBe('update_price')
    expect(row.action).toBe('ignore')
  })

  it('detecta precio inválido como ERROR sin bloquear el resto del archivo', () => {
    const table: RawTable = {
      headers: ['Nombre', 'Unidad', 'Precio'],
      rows: [
        ['Tomate', 'kg', 'no-es-un-precio'],
        ['Cebolla', 'kg', '1,20'],
      ],
    }
    const rows = buildImportRows(table, mapping, [])
    expect(rows[0].status).toBe('error')
    expect(rows[0].action).toBe('ignore')
    expect(rows[1].status).toBe('new')
  })

  it('detecta precio negativo como ERROR', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['Tomate', 'kg', '-1,80']] }
    const [row] = buildImportRows(table, mapping, [])
    expect(row.status).toBe('error')
    expect(row.errors.some((e) => e.includes('negativo'))).toBe(true)
  })

  it('detecta unidad inválida como ERROR sin inventar un valor', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['Tomate', 'cajas', '1,80']] }
    const [row] = buildImportRows(table, mapping, [])
    expect(row.status).toBe('error')
    expect(row.usageUnit).toBeNull()
  })

  it('detecta nombre vacío como ERROR', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['', 'kg', '1,80']] }
    const [row] = buildImportRows(table, mapping, [])
    expect(row.status).toBe('error')
    expect(row.errors.some((e) => e.includes('Nombre'))).toBe(true)
  })

  it('ignora filas completamente vacías', () => {
    const table: RawTable = { headers: ['Nombre', 'Unidad', 'Precio'], rows: [['', '', '']] }
    const [row] = buildImportRows(table, mapping, [])
    expect(row.status).toBe('ignored')
  })
})
