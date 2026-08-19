import { useRef, useState, type DragEvent } from 'react'

type Props = {
  onFile: (file: File) => void
  onPasteText: (text: string) => void
  parsing: boolean
  error: string | null
}

export function SourceStep({ onFile, onPasteText, parsing, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteValue, setPasteValue] = useState('')

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Importar ingredientes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Importa tu lista de ingredientes desde Excel, CSV, texto o PDF.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
        }`}
      >
        {parsing ? (
          <p className="text-sm text-neutral-500">Analizando archivo…</p>
        ) : (
          <>
            <p className="text-sm text-neutral-700">Arrastra tu archivo aquí</p>
            <p className="text-sm text-neutral-500">
              o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-neutral-900 underline underline-offset-2"
              >
                selecciona un archivo
              </button>
            </p>
            <p className="text-xs text-neutral-400">Excel · CSV · PDF</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowPaste((v) => !v)}
          className="text-sm font-medium text-neutral-700 underline underline-offset-2"
        >
          Pegar texto
        </button>
      </div>

      {showPaste && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder={'Tomate;kg;1,80\nCebolla;kg;1,20\nSal;kg;0,60'}
            rows={6}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            disabled={!pasteValue.trim() || parsing}
            onClick={() => onPasteText(pasteValue)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  )
}
