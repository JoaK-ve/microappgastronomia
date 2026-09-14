import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EquivalencesSection } from '@/features/ingredients/EquivalencesSection'
import { PurchaseFormatsSection } from '@/features/ingredients/PurchaseFormatsSection'
import { ALLERGENS, ALLERGEN_LABEL } from '@/lib/allergens'
import type { Allergen, IngredientDeleteBlockers, Unit } from '@/types'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'ud']

export function IngredientFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [ingredientId, setIngredientId] = useState<string | null>(id ?? null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [usageUnit, setUsageUnit] = useState<Unit>('g')
  const [allergens, setAllergens] = useState<Set<Allergen>>(new Set())

  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deleteState, setDeleteState] = useState<'idle' | 'checking' | 'blocked' | 'confirm' | 'deleting'>('idle')
  const [deleteBlockers, setDeleteBlockers] = useState<IngredientDeleteBlockers | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void loadIngredient(id)
  }, [id])

  async function loadIngredient(ingredientIdToLoad: string) {
    setLoading(true)
    const [{ data }, { data: allergenRows }] = await Promise.all([
      supabase.from('ingredients').select('*').eq('id', ingredientIdToLoad).single(),
      supabase.from('ingredient_allergens').select('allergen').eq('ingredient_id', ingredientIdToLoad),
    ])
    if (data) {
      setName(data.name)
      setCategory(data.category ?? '')
      setUsageUnit(data.usage_unit)
      setAllergens(new Set((allergenRows ?? []).map((row) => row.allergen as Allergen)))
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  function toggleAllergen(allergen: Allergen) {
    setAllergens((prev) => {
      const next = new Set(prev)
      if (next.has(allergen)) {
        next.delete(allergen)
      } else {
        next.add(allergen)
      }
      return next
    })
  }

  // Reemplaza siempre el conjunto completo: más simple que calcular el
  // diff, y el volumen (máximo 14 filas) no lo justifica.
  async function saveAllergens(targetIngredientId: string) {
    await supabase.from('ingredient_allergens').delete().eq('ingredient_id', targetIngredientId)
    if (allergens.size === 0 || !profile) return
    await supabase.from('ingredient_allergens').insert(
      Array.from(allergens).map((allergen) => ({
        ingredient_id: targetIngredientId,
        allergen,
        business_id: profile.business_id,
      })),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!profile) return

    setSaving(true)

    if (ingredientId) {
      const { error: updateError } = await supabase
        .from('ingredients')
        .update({ name, category: category || null, usage_unit: usageUnit })
        .eq('id', ingredientId)

      if (updateError) {
        setSaving(false)
        setError('No se pudo guardar el ingrediente.')
        return
      }

      await saveAllergens(ingredientId)
      setSaving(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('ingredients')
      .insert({ business_id: profile.business_id, name, category: category || null, usage_unit: usageUnit })
      .select('id')
      .single()

    if (insertError || !data) {
      setSaving(false)
      setError('No se pudo crear el ingrediente.')
      return
    }

    await saveAllergens(data.id)
    setSaving(false)
    setIngredientId(data.id)
    navigate(`/ingredientes/${data.id}`, { replace: true })
  }

  async function handleDeleteClick() {
    if (!ingredientId) return
    setDeleteState('checking')
    setDeleteError(null)

    const { data, error: checkError } = await supabase
      .rpc('get_ingredient_delete_blockers', { p_ingredient_id: ingredientId })
      .single()

    if (checkError || !data) {
      setDeleteError('No se pudo comprobar las dependencias del ingrediente. Inténtalo de nuevo.')
      setDeleteState('idle')
      return
    }

    const blockers = data as IngredientDeleteBlockers
    setDeleteBlockers(blockers)
    setDeleteState(blockers.used_in_recipe_count > 0 ? 'blocked' : 'confirm')
  }

  async function handleDeleteConfirm() {
    if (!ingredientId) return
    setDeleteState('deleting')
    setDeleteError(null)

    const { error: deleteRequestError } = await supabase.from('ingredients').delete().eq('id', ingredientId)

    if (deleteRequestError) {
      setDeleteError(
        'No se pudo eliminar el ingrediente. Puede que se haya empezado a usar en una receta justo ahora — recarga la página e inténtalo de nuevo.',
      )
      setDeleteState('confirm')
      return
    }

    navigate('/ingredientes', { replace: true })
  }

  function handleDeleteCancel() {
    setDeleteState('idle')
    setDeleteError(null)
  }

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  if (notFound) {
    return <p className="text-neutral-500">Ingrediente no encontrado.</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{ingredientId ? 'Editar ingrediente' : 'Nuevo ingrediente'}</h1>
        {ingredientId && profile?.role === 'admin' && (
          <button
            type="button"
            onClick={() => void handleDeleteClick()}
            disabled={deleteState === 'checking'}
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
          >
            {deleteState === 'checking' ? 'Comprobando…' : 'Eliminar'}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={deleteState === 'blocked' || deleteState === 'confirm' || deleteState === 'deleting'}
        title={deleteState === 'blocked' ? 'No se puede eliminar' : 'Eliminar ingrediente'}
        description={
          deleteState === 'blocked' && deleteBlockers ? (
            <>
              <p>
                Este ingrediente no puede eliminarse porque está utilizado en {deleteBlockers.used_in_recipe_count}{' '}
                receta{deleteBlockers.used_in_recipe_count === 1 ? '' : 's'}:
              </p>
              <ul className="mt-2 list-disc pl-5">
                {deleteBlockers.used_in_recipe_names.map((recipeName) => (
                  <li key={recipeName}>{recipeName}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>
                ¿Quieres eliminar &quot;{name}&quot;? Esta acción no se puede deshacer.
              </p>
              {deleteBlockers && deleteBlockers.purchase_format_count > 0 && (
                <p className="mt-2">
                  También se eliminarán sus {deleteBlockers.purchase_format_count} formato(s) de compra y su
                  historial de precios.
                </p>
              )}
            </>
          )
        }
        onConfirm={deleteState === 'blocked' ? undefined : () => void handleDeleteConfirm()}
        onCancel={handleDeleteCancel}
        loading={deleteState === 'deleting'}
        error={deleteError}
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-medium">Datos básicos</h2>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
            <label htmlFor="usageUnit" className="block text-sm font-medium text-neutral-700">
              Unidad de uso
            </label>
            <select
              id="usageUnit"
              value={usageUnit}
              onChange={(event) => setUsageUnit(event.target.value as Unit)}
              className="mt-1 w-full max-w-[10rem] rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-sm font-medium text-neutral-700">Alérgenos</span>
            <p className="mt-0.5 text-xs text-neutral-500">
              Los que contiene este ingrediente — las recetas que lo usan los heredan solas.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {ALLERGENS.map((allergen) => (
                <label key={allergen} className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={allergens.has(allergen)}
                    onChange={() => toggleAllergen(allergen)}
                  />
                  {ALLERGEN_LABEL[allergen]}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Guardando…' : ingredientId ? 'Guardar cambios' : 'Crear ingrediente'}
          </button>
        </form>
      </section>

      {ingredientId && profile && (
        <>
          <EquivalencesSection ingredientId={ingredientId} businessId={profile.business_id} />
          <PurchaseFormatsSection ingredientId={ingredientId} businessId={profile.business_id} />
        </>
      )}

      {!ingredientId && (
        <p className="text-sm text-neutral-500">
          Guarda los datos básicos primero para poder añadir equivalencias y formatos de compra.
        </p>
      )}
    </div>
  )
}
