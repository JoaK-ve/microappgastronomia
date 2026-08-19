import { describe, expect, it } from 'vitest'
import { mapUnit, normalizeIngredientName, parsePrice } from '@/features/ingredients/import/unitMapping'

describe('mapUnit', () => {
  it('reconoce sinónimos comunes en español', () => {
    expect(mapUnit('kg')).toBe('kg')
    expect(mapUnit('Kilo')).toBe('kg')
    expect(mapUnit('kilogramos')).toBe('kg')
    expect(mapUnit('gr')).toBe('g')
    expect(mapUnit('Gramos')).toBe('g')
    expect(mapUnit('L')).toBe('L')
    expect(mapUnit('litro')).toBe('L')
    expect(mapUnit('Lt.')).toBe('L')
    expect(mapUnit('ml')).toBe('ml')
    expect(mapUnit('unidad')).toBe('ud')
    expect(mapUnit('Uds')).toBe('ud')
    expect(mapUnit('pz')).toBe('ud')
  })

  it('devuelve null para unidades no reconocidas, nunca inventa un valor', () => {
    expect(mapUnit('cajas')).toBeNull()
    expect(mapUnit('')).toBeNull()
    expect(mapUnit('xyz')).toBeNull()
  })
})

describe('parsePrice', () => {
  it('interpreta formato español con coma decimal', () => {
    expect(parsePrice('1,80')).toBeCloseTo(1.8)
  })

  it('interpreta formato con punto decimal', () => {
    expect(parsePrice('1.80')).toBeCloseTo(1.8)
  })

  it('interpreta miles con punto y decimales con coma', () => {
    expect(parsePrice('1.234,56')).toBeCloseTo(1234.56)
  })

  it('interpreta miles con coma y decimales con punto', () => {
    expect(parsePrice('1,234.56')).toBeCloseTo(1234.56)
  })

  it('ignora símbolo de moneda y espacios', () => {
    expect(parsePrice(' 4,90 € ')).toBeCloseTo(4.9)
  })

  it('devuelve null para texto no numérico', () => {
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('')).toBeNull()
  })

  it('permite negativos a nivel de parseo (la validación del negativo va aparte)', () => {
    expect(parsePrice('-1,80')).toBeCloseTo(-1.8)
  })
})

describe('normalizeIngredientName', () => {
  it('normaliza mayúsculas, acentos y espacios para detectar duplicados', () => {
    expect(normalizeIngredientName('Tomate')).toBe(normalizeIngredientName('tomate'))
    expect(normalizeIngredientName('Aceite de oliva')).toBe(normalizeIngredientName('aceite   de oliva'))
    expect(normalizeIngredientName('Jamón')).toBe(normalizeIngredientName('jamon'))
  })
})
