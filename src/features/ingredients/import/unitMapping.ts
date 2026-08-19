import type { Unit } from '@/types'

const UNIT_SYNONYMS: Record<Unit, string[]> = {
  g: ['g', 'gr', 'grs', 'gramo', 'gramos'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos'],
  ml: ['ml', 'mls', 'mililitro', 'mililitros'],
  L: ['l', 'lt', 'lts', 'litro', 'litros'],
  ud: ['ud', 'uds', 'u', 'un', 'unid', 'unidad', 'unidades', 'pz', 'pza', 'pzas', 'pieza', 'piezas'],
}

const DIACRITICS_REGEX = /\p{Diacritic}/gu

export function normalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
}

export function mapUnit(raw: string): Unit | null {
  const normalized = normalizeText(raw)
  if (!normalized) return null
  for (const unit of Object.keys(UNIT_SYNONYMS) as Unit[]) {
    if (UNIT_SYNONYMS[unit].includes(normalized)) return unit
  }
  return null
}

export function parsePrice(raw: string): number | null {
  let s = raw.trim().replace(/[€$]/g, '').replace(/\s/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.')
  }

  const value = Number(s)
  if (!Number.isFinite(value)) return null
  return value
}

export function normalizeIngredientName(name: string): string {
  return normalizeText(name).replace(/\s+/g, ' ')
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'al'])

// Clave laxa para "coincidencias razonables" (sección 8): ignora
// preposiciones/artículos comunes y el orden de las palabras, para que
// "Aceite de oliva" y "Aceite Oliva" se detecten como posible duplicado
// sin llegar a fusionarse solos.
export function fuzzyIngredientKey(name: string): string {
  const words = normalizeIngredientName(name)
    .split(' ')
    .filter((word) => word && !STOPWORDS.has(word))
  return [...words].sort().join(' ')
}
