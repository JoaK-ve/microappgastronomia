import { describe, expect, it } from 'vitest'
import {
  backupBelongsToBusiness,
  buildBackupFileName,
  formatCounts,
  parseBackupFile,
  summarizeBackup,
  summarizeCounts,
  type BackupFile,
} from '@/features/settings/backupFile'

function validBackup(overrides: Record<string, unknown> = {}) {
  return {
    app: 'oidochef',
    format_version: 1,
    exported_at: '2026-09-21T10:00:00Z',
    business: { id: 'biz-1', name: 'La Esquina Caliente' },
    tables: {
      ingredients: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }],
      recipes: [{ id: 'r1' }],
      productions: [],
      purchase_formats: [{ id: 'p1' }, { id: 'p2' }],
    },
    ...overrides,
  }
}

describe('parseBackupFile', () => {
  it('acepta un respaldo bien formado', () => {
    const result = parseBackupFile(JSON.stringify(validBackup()))
    expect(result.ok).toBe(true)
  })

  it('rechaza texto que no es JSON', () => {
    const result = parseBackupFile('esto no es un respaldo')
    expect(result.ok).toBe(false)
  })

  it('rechaza JSON que no es un objeto', () => {
    expect(parseBackupFile('[1,2,3]').ok).toBe(false)
    expect(parseBackupFile('"hola"').ok).toBe(false)
    expect(parseBackupFile('null').ok).toBe(false)
  })

  it('rechaza un archivo de otra aplicación', () => {
    const result = parseBackupFile(JSON.stringify(validBackup({ app: 'wheelos' })))
    expect(result).toEqual({ ok: false, error: 'El archivo no es un respaldo de OídoChef.' })
  })

  it('rechaza una versión de formato desconocida', () => {
    const result = parseBackupFile(JSON.stringify(validBackup({ format_version: 2 })))
    expect(result.ok).toBe(false)
  })

  it('rechaza si no dice de qué negocio es', () => {
    expect(parseBackupFile(JSON.stringify(validBackup({ business: {} }))).ok).toBe(false)
    expect(parseBackupFile(JSON.stringify(validBackup({ business: undefined }))).ok).toBe(false)
  })

  it('rechaza si una sección no es una lista', () => {
    const tables = { ingredients: { a: 1 }, recipes: [] }
    expect(parseBackupFile(JSON.stringify(validBackup({ tables }))).ok).toBe(false)
  })

  it('rechaza un archivo sin ingredientes o sin recetas (truncado: vaciaría el negocio)', () => {
    expect(parseBackupFile(JSON.stringify(validBackup({ tables: { recipes: [] } }))).ok).toBe(false)
    expect(parseBackupFile(JSON.stringify(validBackup({ tables: { ingredients: [] } }))).ok).toBe(false)
  })

  it('acepta un negocio vacío legítimo (listas presentes pero sin filas)', () => {
    const tables = { ingredients: [], recipes: [] }
    expect(parseBackupFile(JSON.stringify(validBackup({ tables }))).ok).toBe(true)
  })
})

describe('backupBelongsToBusiness', () => {
  it('solo es verdadero para el negocio del que salió el archivo', () => {
    const backup = validBackup() as unknown as BackupFile
    expect(backupBelongsToBusiness(backup, 'biz-1')).toBe(true)
    expect(backupBelongsToBusiness(backup, 'biz-2')).toBe(false)
  })
})

describe('resúmenes', () => {
  it('cuenta lo que trae el respaldo, con plurales correctos', () => {
    const backup = validBackup() as unknown as BackupFile
    expect(formatCounts(summarizeBackup(backup))).toBe(
      '3 ingredientes, 1 receta, 0 producciones, 2 formatos de compra',
    )
  })

  it('cuenta lo que hay ahora, tratando lo que falta como cero', () => {
    expect(formatCounts(summarizeCounts({ ingredients: 1, recipes: 5 }))).toBe(
      '1 ingrediente, 5 recetas, 0 producciones, 0 formatos de compra',
    )
  })
})

describe('buildBackupFileName', () => {
  const date = new Date('2026-09-21T15:30:00Z')

  it('usa el nombre del negocio sin tildes ni símbolos', () => {
    expect(buildBackupFileName('Tío Pollo', date)).toBe('oidochef-respaldo-tio-pollo-2026-09-21.json')
    expect(buildBackupFileName('La Esquina Caliente!!', date)).toBe(
      'oidochef-respaldo-la-esquina-caliente-2026-09-21.json',
    )
  })

  it('no deja un nombre vacío si el negocio solo tiene símbolos', () => {
    expect(buildBackupFileName('***', date)).toBe('oidochef-respaldo-negocio-2026-09-21.json')
  })
})
