import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'

type ActionKey = 'ingredientes' | 'recetas' | 'produccion'

const ACTIONS: { to: string; key: ActionKey; title: string; description: string }[] = [
  {
    to: '/ingredientes',
    key: 'ingredientes',
    title: 'Ingredientes',
    description: 'Materias primas, formatos de compra y precios.',
  },
  {
    to: '/recetas',
    key: 'recetas',
    title: 'Recetas',
    description: 'Fichas de cocina, escandallo y coste actualizado.',
  },
  {
    to: '/produccion',
    key: 'produccion',
    title: 'Producción',
    description: 'Escala una receta a la cantidad que necesitas.',
  },
]

export function HomePage() {
  const { profile } = useAuth()
  const [counts, setCounts] = useState<Partial<Record<ActionKey, number>>>({})

  useEffect(() => {
    void loadCounts()
  }, [])

  async function loadCounts() {
    const [ingredientsResult, recipesResult] = await Promise.all([
      supabase.from('ingredients').select('*', { count: 'exact', head: true }),
      supabase.from('recipes').select('*', { count: 'exact', head: true }),
    ])
    setCounts({
      ingredientes: ingredientsResult.count ?? undefined,
      recetas: recipesResult.count ?? undefined,
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Hola, {profile?.name?.split(' ')[0] ?? 'chef'}</h1>
      <p className="mt-1 text-neutral-500">¿Qué quieres hacer?</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const count = counts[action.key]
          return (
            <Link
              key={action.to}
              to={action.to}
              className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{action.title}</h2>
                {count != null && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {count}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-500">{action.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
