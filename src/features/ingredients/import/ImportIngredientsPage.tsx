import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { autoDetectMapping } from '@/features/ingredients/import/columnMapping'
import { buildImportRows, buildNameMatchIndex, type NameMatchIndex } from '@/features/ingredients/import/buildRows'
import { MappingStep } from '@/features/ingredients/import/MappingStep'
import { parseCsvFile, parseDelimitedText, parseExcelFile } from '@/features/ingredients/import/parsers'
import { parsePdfFile } from '@/features/ingredients/import/pdfParser'
import { PreviewTable } from '@/features/ingredients/import/PreviewTable'
import { SourceStep } from '@/features/ingredients/import/SourceStep'
import type { ColumnMapping, ImportRow, ParsedSource } from '@/features/ingredients/import/types'
import type { Ingredient, ImportRowResult } from '@/types'

type Step = 'source' | 'sheet' | 'mapping' | 'preview' | 'confirm' | 'importing' | 'result'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ImportIngredientsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [step, setStep] = useState<Step>('source')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [sourceWarning, setSourceWarning] = useState<string | null>(null)

  const [parsedSource, setParsedSource] = useState<ParsedSource | null>(null)
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)

  const [matchIndex, setMatchIndex] = useState<NameMatchIndex | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResults, setImportResults] = useState<ImportRowResult[]>([])

  async function loadExistingIngredients(): Promise<Ingredient[]> {
    const { data } = await supabase.from('ingredients').select('*')
    return (data as Ingredient[]) ?? []
  }

  async function handleFile(file: File) {
    setSourceError(null)
    setParsing(true)
    setFileName(file.name)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let parsed: ParsedSource
      if (ext === 'xlsx') {
        parsed = await parseExcelFile(file)
      } else if (ext === 'csv') {
        parsed = await parseCsvFile(file)
      } else if (ext === 'pdf') {
        parsed = await parsePdfFile(file)
      } else {
        setSourceError('Formato no soportado. Usa .xlsx, .csv o .pdf.')
        setParsing(false)
        return
      }

      if (parsed.sheets.length === 0) {
        setSourceError(parsed.warning ?? 'No se pudo interpretar el archivo.')
        setParsing(false)
        return
      }

      setParsedSource(parsed)
      setSourceWarning(parsed.warning)
      setSelectedSheet(0)
      setParsing(false)

      if (parsed.sheets.length > 1) {
        setStep('sheet')
      } else {
        proceedToMapping(parsed.sheets[0].table)
      }
    } catch {
      setSourceError('No se pudo leer el archivo. Comprueba que no esté dañado.')
      setParsing(false)
    }
  }

  function handlePasteText(text: string) {
    setSourceError(null)
    setFileName('Texto pegado')
    const parsed = parseDelimitedText(text)
    if (parsed.sheets.length === 0) {
      setSourceError(parsed.warning ?? 'No se pudo interpretar el texto.')
      return
    }
    setParsedSource(parsed)
    setSourceWarning(parsed.warning)
    proceedToMapping(parsed.sheets[0].table)
  }

  function proceedToMapping(table: { headers: string[]; rows: string[][] }) {
    setMapping(autoDetectMapping(table.headers))
    setStep('mapping')
  }

  async function handleMappingContinue() {
    if (!parsedSource || !mapping) return
    const table = parsedSource.sheets[selectedSheet].table
    const existing = await loadExistingIngredients()
    const index = buildNameMatchIndex(existing)
    setMatchIndex(index)
    setRows(buildImportRows(table, mapping, existing))
    setStep('preview')
  }

  async function handleReviewAgain() {
    if (!parsedSource || !mapping) return
    const existing = await loadExistingIngredients()
    const index = buildNameMatchIndex(existing)
    setMatchIndex(index)
    setRows(buildImportRows(parsedSource.sheets[selectedSheet].table, mapping, existing))
    setStep('preview')
  }

  async function handleConfirmImport() {
    setStep('importing')
    setImporting(true)
    setImportError(null)

    const payload = rows
      .filter((r) => r.action !== 'ignore')
      .map((r) => ({
        client_id: r.clientId,
        action: r.action,
        name: r.name,
        category: r.category,
        usage_unit: r.usageUnit,
        existing_ingredient_id: r.matchedIngredientId,
        purchase:
          r.price != null && r.quantity != null && r.usageUnit != null
            ? {
                description: r.purchaseDescription || 'Importado',
                quantity: r.quantity,
                unit: r.usageUnit,
                price: r.price,
                price_date: todayIso(),
              }
            : null,
      }))

    const { data, error } = await supabase.rpc('import_ingredients', { p_rows: payload })

    setImporting(false)

    if (error) {
      setImportError(error.message)
      setStep('confirm')
      return
    }

    setImportResults((data as ImportRowResult[]) ?? [])
    setStep('result')
  }

  if (!profile) return null

  const approvedRows = rows.filter((r) => r.action !== 'ignore')
  const createCount = rows.filter((r) => r.action === 'create').length
  const updateCount = rows.filter((r) => r.action === 'update_price').length
  const ignoreCount = rows.length - approvedRows.length
  const errorCount = rows.filter((r) => r.status === 'error').length

  return (
    <div className="max-w-5xl space-y-6">
      {step === 'source' && (
        <SourceStep onFile={handleFile} onPasteText={handlePasteText} parsing={parsing} error={sourceError} />
      )}

      {step === 'sheet' && parsedSource && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Selecciona la hoja</h1>
          <p className="text-sm text-neutral-500">Este archivo tiene varias hojas con datos. Elige cuál importar.</p>
          <div className="space-y-2">
            {parsedSource.sheets.map((sheet, i) => (
              <label
                key={sheet.name}
                className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <input
                  type="radio"
                  name="sheet"
                  checked={selectedSheet === i}
                  onChange={() => setSelectedSheet(i)}
                />
                <span className="font-medium">{sheet.name}</span>
                <span className="text-neutral-400">({sheet.table.rows.length} filas)</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => proceedToMapping(parsedSource.sheets[selectedSheet].table)}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 'mapping' && parsedSource && mapping && (
        <MappingStep
          table={parsedSource.sheets[selectedSheet].table}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep('source')}
          onContinue={() => void handleMappingContinue()}
        />
      )}

      {step === 'preview' && matchIndex && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Importar ingredientes</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Archivo: <strong>{fileName}</strong> · Filas detectadas: {rows.length} · Errores: {errorCount}
            </p>
            {sourceWarning && <p className="mt-1 text-sm text-amber-600">{sourceWarning}</p>}
          </div>

          <PreviewTable rows={rows} index={matchIndex} onUpdate={setRows} />

          <p className="text-sm text-neutral-600">
            Puedes importar {createCount + updateCount} de {rows.length} filas ({errorCount} con errores,{' '}
            {ignoreCount} se ignorarán).
          </p>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={approvedRows.length === 0}
              onClick={() => setStep('confirm')}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold">Listo para importar</h1>

          {importError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</p>}

          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
            <p>{rows.length} filas analizadas</p>
            <ul className="mt-2 space-y-1">
              <li>🟢 {createCount} ingredientes nuevos</li>
              <li>🟠 {updateCount} actualizaciones de precio</li>
              <li>⚪ {ignoreCount} se ignorarán</li>
              {errorCount > 0 && <li>🔴 {errorCount} con errores</li>}
            </ul>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => void handleReviewAgain()}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Volver a revisar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmImport()}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Confirmar importación
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Importando…</h1>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className={`h-full w-1/2 bg-neutral-900 ${importing ? 'animate-pulse' : ''}`} />
          </div>
          <p className="text-sm text-neutral-500">Escribiendo los ingredientes aprobados…</p>
        </div>
      )}

      {step === 'result' && (
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold">Importación completada</h1>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
            <ul className="space-y-1">
              <li>✅ {importResults.filter((r) => r.status === 'created').length} ingredientes creados</li>
              <li>🔄 {importResults.filter((r) => r.status === 'updated').length} ingredientes actualizados</li>
              <li>⚠️ {importResults.filter((r) => r.status === 'error').length} requieren revisión</li>
              <li>⏭️ {ignoreCount} ignorados</li>
            </ul>
            {importResults.some((r) => r.status === 'error') && (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <p className="font-medium text-red-700">Errores:</p>
                <ul className="mt-1 space-y-0.5 text-red-600">
                  {importResults
                    .filter((r) => r.status === 'error')
                    .map((r) => (
                      <li key={r.client_id}>{r.message}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/ingredientes')}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ver ingredientes
          </button>
        </div>
      )}
    </div>
  )
}
