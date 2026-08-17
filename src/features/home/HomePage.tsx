import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

const ACTIONS = [
  {
    to: '/ingredientes',
    title: 'Ingredientes',
    description: 'Materias primas, formatos de compra y precios.',
  },
  {
    to: '/recetas',
    title: 'Recetas',
    description: 'Fichas de cocina, escandallo y coste actualizado.',
  },
  {
    to: '/produccion',
    title: 'Producción',
    description: 'Escala una receta a la cantidad que necesitas.',
  },
]

export function HomePage() {
  const { profile } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-semibold">Hola, {profile?.name?.split(' ')[0] ?? 'chef'}</h1>
      <p className="mt-1 text-neutral-500">¿Qué quieres hacer?</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
          >
            <h2 className="text-lg font-medium">{action.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
