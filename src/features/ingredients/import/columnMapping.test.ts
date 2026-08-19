import { describe, expect, it } from 'vitest'
import { autoDetectMapping } from '@/features/ingredients/import/columnMapping'

describe('autoDetectMapping', () => {
  it('detecta encabezados típicos de proveedor', () => {
    const mapping = autoDetectMapping(['Nombre producto', 'Unidad', 'Precio compra'])
    expect(mapping.name).toBe(0)
    expect(mapping.unit).toBe(1)
    expect(mapping.price).toBe(2)
    expect(mapping.category).toBeNull()
  })

  it('reconoce variantes en español (Ingrediente, Ud., P. compra)', () => {
    const mapping = autoDetectMapping(['Ingrediente', 'Categoría', 'Ud.', 'P. compra'])
    expect(mapping.name).toBe(0)
    expect(mapping.category).toBe(1)
    expect(mapping.unit).toBe(2)
    expect(mapping.price).toBe(3)
  })

  it('deja "sin utilizar" (null) las columnas que no reconoce', () => {
    const mapping = autoDetectMapping(['Nombre', 'Unidad', 'Precio', 'Proveedor habitual'])
    expect(mapping.name).toBe(0)
    expect(mapping.unit).toBe(1)
    expect(mapping.price).toBe(2)
    expect(mapping.quantity).toBeNull()
    expect(mapping.purchaseDescription).toBeNull()
  })

  it('nunca asigna la misma columna a dos campos', () => {
    const mapping = autoDetectMapping(['Nombre', 'Unidad', 'Precio'])
    const used = Object.values(mapping).filter((v) => v != null)
    expect(new Set(used).size).toBe(used.length)
  })
})
