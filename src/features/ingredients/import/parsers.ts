import ExcelJS from 'exceljs'
import type { ParsedSource, RawTable } from '@/features/ingredients/import/types'

function rowsFromCells(cells: string[][]): RawTable {
  const nonEmpty = cells.filter((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const headers = nonEmpty[0].map((h) => h.trim())
  const rows = nonEmpty.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''))
  return { headers, rows }
}

export async function parseExcelFile(file: File): Promise<ParsedSource> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheets: { name: string; table: RawTable }[] = []

  workbook.eachSheet((worksheet) => {
    const cells: string[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as (string | number | null | undefined)[]).slice(1)
      cells.push(values.map((v) => (v == null ? '' : String(v).trim())))
    })
    const table = rowsFromCells(cells)
    if (table.headers.length > 0) {
      sheets.push({ name: worksheet.name, table })
    }
  })

  if (sheets.length === 0) {
    return { sheets: [], warning: 'No se encontraron hojas con datos en este archivo.' }
  }

  return { sheets, warning: null }
}

function detectDelimiter(sampleLine: string): string {
  const candidates = [';', ',', '\t']
  let best = ';'
  let bestCount = -1
  for (const candidate of candidates) {
    const count = sampleLine.split(candidate).length
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((cell) => cell.trim())
}

export function parseDelimitedText(text: string): ParsedSource {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) {
    return { sheets: [], warning: 'No se detectó contenido para interpretar.' }
  }

  const delimiter = detectDelimiter(lines[0])
  const cells = lines.map((line) => splitCsvLine(line, delimiter))
  const table = rowsFromCells(cells)

  if (table.headers.length === 0) {
    return { sheets: [], warning: 'No se pudieron detectar columnas en el texto.' }
  }

  return { sheets: [{ name: 'Datos', table }], warning: null }
}

export async function parseCsvFile(file: File): Promise<ParsedSource> {
  const text = await file.text()
  return parseDelimitedText(text)
}
