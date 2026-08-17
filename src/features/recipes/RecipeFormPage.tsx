import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { RecipeComponentsSection } from '@/features/recipes/RecipeComponentsSection'
import type { Unit } from '@/types'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'ud']

export function RecipeFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [recipeId, setRecipeId] = useState<string | null>(id ?? null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('active')

  const [steps, setSteps] = useState<string[]>([])
  const [newStep, setNewStep] = useState('')

  const [yieldQuantity, setYieldQuantity] = useState('')
  const [yieldUnit, setYieldUnit] = useState<Unit>('g')

  const [conservationMethod, setConservationMethod] = useState('')
  const [conservationTemperature, setConservationTemperature] = useState('')
  const [conservationShelfLife, setConservationShelfLife] = useState('')
  const [conservationNotes, setConservationNotes] = useState('')

  const [loading, setLoading] = useState(Boolean(id))
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void loadRecipe(id)
  }, [id])

  async function loadRecipe(recipeIdToLoad: string) {
    setLoading(true)
    const { data } = await supabase.from('recipes').select('*').eq('id', recipeIdToLoad).single()
    if (data) {
      setName(data.name)
      setCategory(data.category ?? '')
      setCode(data.code ?? '')
      setStatus(data.status)
      setSteps(data.steps ?? [])
      setYieldQuantity(data.yield_quantity != null ? String(data.yield_quantity) : '')
      if (data.yield_unit) setYieldUnit(data.yield_unit)
      setConservationMethod(data.conservation_method ?? '')
      setConservationTemperature(data.conservation_temperature ?? '')
      setConservationShelfLife(data.conservation_shelf_life ?? '')
      setConservationNotes(data.conservation_notes ?? '')
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  function addStep() {
    if (!newStep.trim()) return
    setSteps((prev) => [...prev, newStep.trim()])
    setNewStep('')
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setError(null)

    if (!profile) return

    setSaving(true)

    const payload = {
      name,
      category: category || null,
      code: code || null,
      status,
      steps,
      // El rendimiento puede quedar vacío (sección 19): la receta se guarda igual.
      yield_quantity: yieldQuantity ? Number(yieldQuantity) : null,
      yield_unit: yieldQuantity ? yieldUnit : null,
      conservation_method: conservationMethod || null,
      conservation_temperature: conservationTemperature || null,
      conservation_shelf_life: conservationShelfLife || null,
      conservation_notes: conservationNotes || null,
    }

    if (recipeId) {
      const { error: updateError } = await supabase.from('recipes').update(payload).eq('id', recipeId)
      setSaving(false)
      if (updateError) {
        setError('No se pudo guardar la receta.')
        return
      }
      return
    }

    const { data, error: insertError } = await supabase
      .from('recipes')
      .insert({ ...payload, business_id: profile.business_id })
      .select('id')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError('No se pudo crear la receta.')
      return
    }

    setRecipeId(data.id)
    navigate(`/recetas/${data.id}/editar`, { replace: true })
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  if (notFound) {
    return <p className="text-neutral-500">Receta no encontrada.</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      {recipeId && (
        <Link to={`/recetas/${recipeId}`} className="text-sm text-neutral-500 hover:underline">
          ← Ver ficha
        </Link>
      )}
      <h1 className="text-2xl font-semibold">{recipeId ? 'Editar receta' : 'Nueva receta'}</h1>

      <div className="space-y-6">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-medium">Identificación</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
                Nombre
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-neutral-700">
                  Categoría
                </label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-neutral-700">
                  Código
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-neutral-700">
                  Estado
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="active">Activa</option>
                  <option value="archived">Archivada</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {recipeId && profile && <RecipeComponentsSection recipeId={recipeId} businessId={profile.business_id} />}

        {!recipeId && (
          <p className="text-sm text-neutral-500">Guarda los datos básicos primero para poder añadir componentes.</p>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-medium">Elaboración</h2>
          {steps.length > 0 && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start justify-between gap-2">
                  <span>{step}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="shrink-0 text-neutral-400 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Añadir paso…"
              value={newStep}
              onChange={(event) => setNewStep(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addStep()
                }
              }}
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addStep}
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700"
            >
              Añadir
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-medium">Rendimiento</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Puede dejarse vacío — la receta se guarda igual, pero no se podrá calcular el coste por unidad de
            rendimiento hasta que se defina.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Cantidad"
              value={yieldQuantity}
              onChange={(event) => setYieldQuantity(event.target.value)}
              className="w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <select
              value={yieldUnit}
              onChange={(event) => setYieldUnit(event.target.value as Unit)}
              disabled={!yieldQuantity}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-medium">Conservación</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="conservationMethod" className="block text-sm font-medium text-neutral-700">
                Método
              </label>
              <input
                id="conservationMethod"
                type="text"
                value={conservationMethod}
                onChange={(event) => setConservationMethod(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="conservationTemperature" className="block text-sm font-medium text-neutral-700">
                Temperatura
              </label>
              <input
                id="conservationTemperature"
                type="text"
                value={conservationTemperature}
                onChange={(event) => setConservationTemperature(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="conservationShelfLife" className="block text-sm font-medium text-neutral-700">
                Vida útil
              </label>
              <input
                id="conservationShelfLife"
                type="text"
                value={conservationShelfLife}
                onChange={(event) => setConservationShelfLife(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="conservationNotes" className="block text-sm font-medium text-neutral-700">
                Observaciones
              </label>
              <input
                id="conservationNotes"
                type="text"
                value={conservationNotes}
                onChange={(event) => setConservationNotes(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Guardando…' : recipeId ? 'Guardar cambios' : 'Crear receta'}
        </button>
      </div>
    </div>
  )
}
