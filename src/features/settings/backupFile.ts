// Lógica pura del respaldo por negocio (descargar / restaurar). La
// restauración de verdad la hace la función restore_business_backup en la
// base de datos, que vuelve a validar todo — esto solo evita mandar un
// archivo que se sabe malo y le explica al usuario qué va a pasar antes.

export const BACKUP_FORMAT_VERSION = 1

// Ingredientes y recetas son obligatorios (un archivo sin ellos dejaría el
// negocio vacío por un archivo truncado); el resto es opcional.
const REQUIRED_TABLES = ['ingredients', 'recipes'] as const

export type BackupFile = {
  app: 'oidochef'
  format_version: number
  exported_at: string
  business: { id: string; name: string }
  tables: Record<string, Record<string, unknown>[]>
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string }

// Etiquetas en el orden en que se muestran en el resumen.
const SUMMARY_LABELS: Array<[string, string, string]> = [
  ['ingredients', 'ingrediente', 'ingredientes'],
  ['recipes', 'receta', 'recetas'],
  ['productions', 'producción', 'producciones'],
  ['purchase_formats', 'formato de compra', 'formatos de compra'],
]

export function parseBackupFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no se puede leer: no es un respaldo de OídoChef.' }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'El archivo no es un respaldo de OídoChef.' }
  }

  const file = data as Record<string, unknown>

  if (file.app !== 'oidochef') {
    return { ok: false, error: 'El archivo no es un respaldo de OídoChef.' }
  }

  if (file.format_version !== BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'Este respaldo tiene un formato que esta versión de la app no reconoce.' }
  }

  const business = file.business as { id?: unknown; name?: unknown } | undefined
  if (!business || typeof business.id !== 'string' || typeof business.name !== 'string') {
    return { ok: false, error: 'El respaldo está dañado (no dice de qué negocio es).' }
  }

  const tables = file.tables
  if (typeof tables !== 'object' || tables === null || Array.isArray(tables)) {
    return { ok: false, error: 'El respaldo está dañado (faltan los datos).' }
  }

  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) {
      return { ok: false, error: `El respaldo está dañado (la sección ${name} no es válida).` }
    }
  }

  for (const required of REQUIRED_TABLES) {
    if (!Array.isArray((tables as Record<string, unknown>)[required])) {
      return { ok: false, error: 'El respaldo está incompleto (faltan ingredientes o recetas).' }
    }
  }

  return { ok: true, backup: file as unknown as BackupFile }
}

export function backupBelongsToBusiness(backup: BackupFile, businessId: string) {
  return backup.business.id === businessId
}

export type Count = { label: string; count: number }

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm
}

export function summarizeBackup(backup: BackupFile): Count[] {
  return SUMMARY_LABELS.map(([key, singular, pluralForm]) => {
    const count = backup.tables[key]?.length ?? 0
    return { label: plural(count, singular, pluralForm), count }
  })
}

export function summarizeCounts(counts: Record<string, number>): Count[] {
  return SUMMARY_LABELS.map(([key, singular, pluralForm]) => {
    const count = counts[key] ?? 0
    return { label: plural(count, singular, pluralForm), count }
  })
}

export function formatCounts(items: Count[]) {
  return items.map((item) => `${item.count} ${item.label}`).join(', ')
}

export function buildBackupFileName(businessName: string, date: Date) {
  const slug =
    businessName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'negocio'
  const day = date.toISOString().slice(0, 10)
  return `oidochef-respaldo-${slug}-${day}.json`
}

export const MAX_BACKUP_FILE_SIZE = 20 * 1024 * 1024
