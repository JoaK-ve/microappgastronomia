import { useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  backupBelongsToBusiness,
  buildBackupFileName,
  formatCounts,
  MAX_BACKUP_FILE_SIZE,
  parseBackupFile,
  summarizeBackup,
  summarizeCounts,
  type BackupFile,
} from '@/features/settings/backupFile'

// Solo lo que se muestra en el resumen "ahora mismo tienes…".
const COUNTED_TABLES = ['ingredients', 'recipes', 'productions', 'purchase_formats'] as const

type PendingRestore = { backup: BackupFile; current: Record<string, number> }

export function BackupSection() {
  const { profile } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoredSummary, setRestoredSummary] = useState<string | null>(null)

  async function handleDownload() {
    setDownloadError(null)
    setRestoredSummary(null)
    setDownloading(true)

    const { data, error } = await supabase.rpc('export_business_backup')

    setDownloading(false)

    if (error || !data) {
      setDownloadError(error?.message ?? 'No se pudo generar el respaldo. Inténtalo de nuevo.')
      return
    }

    const backup = data as BackupFile
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildBackupFileName(backup.business.name, new Date())
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite volver a elegir el mismo archivo después de un error.
    event.target.value = ''
    if (!file || !profile) return

    setFileError(null)
    setRestoredSummary(null)

    if (file.size > MAX_BACKUP_FILE_SIZE) {
      setFileError('El archivo es demasiado grande para ser un respaldo de OídoChef.')
      return
    }

    const parsed = parseBackupFile(await file.text())
    if (!parsed.ok) {
      setFileError(parsed.error)
      return
    }

    if (!backupBelongsToBusiness(parsed.backup, profile.business_id)) {
      setFileError(
        `Este respaldo es de otro negocio («${parsed.backup.business.name}»). Solo se puede restaurar en el negocio del que se descargó.`,
      )
      return
    }

    const entries = await Promise.all(
      COUNTED_TABLES.map(async (table) => {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
        return [table, count ?? 0] as const
      }),
    )

    setAcknowledged(false)
    setRestoreError(null)
    setPending({ backup: parsed.backup, current: Object.fromEntries(entries) })
  }

  async function handleRestore() {
    if (!pending) return

    setRestoring(true)
    setRestoreError(null)

    const { data, error } = await supabase.rpc('restore_business_backup', { p_backup: pending.backup })

    setRestoring(false)

    if (error) {
      setRestoreError(error.message)
      return
    }

    const restored = (data as { restored: Record<string, number> }).restored
    setRestoredSummary(formatCounts(summarizeCounts(restored)))
    setPending(null)
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-medium">Respaldo</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Descarga una copia de los datos de tu negocio, o restaura una anterior. Incluye ingredientes, formatos de
        compra y precios, equivalencias, alérgenos, recetas y producciones. No incluye usuarios ni el logo.
        Descárgala de vez en cuando y guárdala fuera de la app.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {downloading ? 'Preparando…' : 'Descargar respaldo'}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
        >
          Restaurar desde un archivo…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Archivo de respaldo"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      {downloadError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{downloadError}</p>}
      {fileError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}
      {restoredSummary && (
        <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Respaldo restaurado: {restoredSummary}.
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Restaurar respaldo"
        confirmLabel="Restaurar"
        loadingLabel="Restaurando…"
        description={
          pending && (
            <div className="space-y-3">
              <p>
                Respaldo de «{pending.backup.business.name}» del{' '}
                {new Date(pending.backup.exported_at).toLocaleDateString('es-ES')}:{' '}
                <strong>{formatCounts(summarizeBackup(pending.backup))}</strong>.
              </p>
              <p>Ahora mismo tienes: {formatCounts(summarizeCounts(pending.current))}.</p>
              <p>
                Restaurar <strong>reemplaza</strong> todos tus ingredientes, recetas y producciones actuales por los del
                archivo. No toca usuarios, contraseñas ni el logo. Antes de reemplazar se guarda una copia automática de
                lo actual; si te equivocas de archivo, OídoChef puede recuperarla.
              </p>
              <label className="flex items-start gap-2 text-neutral-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                Entiendo que esto reemplaza mis datos actuales
              </label>
            </div>
          )
        }
        onConfirm={() => void handleRestore()}
        onCancel={() => setPending(null)}
        loading={restoring}
        error={restoreError}
        confirmDisabled={!acknowledged}
      />
    </section>
  )
}
