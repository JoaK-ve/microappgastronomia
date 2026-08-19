import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { ParsedSource, RawTable } from '@/features/ingredients/import/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type TextItem = { x: number; y: number; text: string }

const Y_TOLERANCE = 3
const MIN_LINES_FOR_TABLE = 3
const MIN_ROW_MATCH_RATIO = 0.6

function groupIntoLines(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextItem[][] = []

  for (const item of sorted) {
    if (!item.text.trim()) continue
    const last = lines[lines.length - 1]
    if (last && Math.abs(last[0].y - item.y) <= Y_TOLERANCE) {
      last.push(item)
    } else {
      lines.push([item])
    }
  }

  for (const line of lines) line.sort((a, b) => a.x - b.x)
  return lines
}

function modeTokenCount(lines: TextItem[][]): number {
  const counts = new Map<number, number>()
  for (const line of lines) {
    counts.set(line.length, (counts.get(line.length) ?? 0) + 1)
  }
  let best = 0
  let bestCount = 0
  for (const [count, freq] of counts) {
    if (count >= 2 && count <= 8 && freq > bestCount) {
      best = count
      bestCount = freq
    }
  }
  return best
}

function buildColumnBoundaries(lines: TextItem[][], columnCount: number): number[] {
  const matching = lines.filter((line) => line.length === columnCount)
  const positionsByColumn: number[][] = Array.from({ length: columnCount }, () => [])
  for (const line of matching) {
    line.forEach((item, i) => positionsByColumn[i].push(item.x))
  }
  return positionsByColumn.map((positions) => positions.reduce((a, b) => a + b, 0) / positions.length)
}

function assignToColumns(line: TextItem[], boundaries: number[]): string[] {
  const row = new Array(boundaries.length).fill('')
  for (const item of line) {
    let closest = 0
    let closestDist = Infinity
    for (let i = 0; i < boundaries.length; i++) {
      const dist = Math.abs(item.x - boundaries[i])
      if (dist < closestDist) {
        closestDist = dist
        closest = i
      }
    }
    row[closest] = row[closest] ? `${row[closest]} ${item.text}` : item.text
  }
  return row.map((cell) => cell.trim())
}

function looksNumeric(text: string): boolean {
  return /^[\d.,€$\s-]+$/.test(text) && /\d/.test(text)
}

export async function parsePdfFile(file: File): Promise<ParsedSource> {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise

  const allLines: TextItem[][] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const items: TextItem[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item)
      .map((item) => ({
        x: item.transform[4],
        y: item.transform[5],
        text: item.str,
      }))
    allLines.push(...groupIntoLines(items))
  }

  if (allLines.length < MIN_LINES_FOR_TABLE) {
    return {
      sheets: [],
      warning:
        'No hemos podido interpretar este PDF con suficiente confianza (muy poco texto detectado). Puede que sea un PDF escaneado sin capa de texto. Prueba a pegar el contenido como texto.',
    }
  }

  const columnCount = modeTokenCount(allLines)
  if (columnCount < 2) {
    return {
      sheets: [],
      warning:
        'No hemos podido interpretar este PDF con suficiente confianza: no se detectó una estructura de columnas consistente. Prueba a pegar el contenido como texto.',
    }
  }

  const matchingLines = allLines.filter((line) => line.length === columnCount)
  if (matchingLines.length / allLines.length < MIN_ROW_MATCH_RATIO) {
    return {
      sheets: [],
      warning:
        'No hemos podido interpretar este PDF con suficiente confianza: la estructura de filas es irregular. Prueba a pegar el contenido como texto.',
    }
  }

  const boundaries = buildColumnBoundaries(allLines, columnCount)
  const allRows = allLines.map((line) => assignToColumns(line, boundaries))

  const firstRow = allRows[0]
  const firstRowLooksLikeHeader = firstRow.some((cell) => cell !== '') && !firstRow.every(looksNumeric)

  const table: RawTable = firstRowLooksLikeHeader
    ? { headers: firstRow, rows: allRows.slice(1) }
    : { headers: firstRow.map((_, i) => `Columna ${i + 1}`), rows: allRows }

  return {
    sheets: [{ name: 'PDF', table }],
    warning:
      'Interpretación automática de PDF: revisa con atención que las columnas se hayan detectado correctamente antes de continuar.',
  }
}
