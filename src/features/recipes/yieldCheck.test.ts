import { describe, expect, it } from 'vitest'
import { yieldMismatch } from '@/features/recipes/yieldCheck'

const ing = (quantity: number, unit: 'g' | 'kg' | 'ml' | 'L' | 'ud') => ({
  component_type: 'ingredient' as const,
  quantity,
  unit,
})

describe('yieldMismatch', () => {
  it('avisa cuando el rendimiento no cuadra con la suma (caso Mix de Especias)', () => {
    const comps = [ing(100, 'g'), ing(50, 'g'), ing(80, 'g'), ing(40, 'g'), ing(80, 'g'), ing(10, 'g')]
    expect(yieldMismatch(comps, 260, 'g')).toEqual({ sum: 360, unit: 'g' })
  })
  it('no avisa cuando cuadra', () => {
    expect(yieldMismatch([ing(200, 'g'), ing(160, 'g')], 360, 'g')).toBeNull()
  })
  it('tolera diferencias de redondeo', () => {
    expect(yieldMismatch([ing(359, 'g')], 360, 'g')).toBeNull()
  })
  it('convierte unidades de la misma familia', () => {
    expect(yieldMismatch([ing(1, 'kg'), ing(500, 'g')], 1, 'kg')).toEqual({ sum: 1.5, unit: 'kg' })
  })
  it('no compara familias distintas ni unidades', () => {
    expect(yieldMismatch([ing(100, 'g'), ing(50, 'ml')], 300, 'g')).toBeNull()
    expect(yieldMismatch([ing(3, 'ud')], 10, 'ud')).toBeNull()
  })
  it('no compara si hay subrecetas', () => {
    expect(yieldMismatch([ing(100, 'g'), { component_type: 'recipe', quantity: 50, unit: 'g' }], 500, 'g')).toBeNull()
  })
  it('no avisa sin rendimiento o sin componentes', () => {
    expect(yieldMismatch([ing(100, 'g')], 0, 'g')).toBeNull()
    expect(yieldMismatch([], 100, 'g')).toBeNull()
  })
})
