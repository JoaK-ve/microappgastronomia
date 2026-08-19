import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Business, Profile } from '@/types'

export function SuperAdminUsersDirectoryPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [businesses, setBusinesses] = useState<Record<string, Business>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: usersData }, { data: businessesData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('businesses').select('*'),
    ])
    setUsers((usersData as Profile[]) ?? [])
    const map: Record<string, Business> = {}
    for (const business of (businessesData as Business[]) ?? []) map[business.id] = business
    setBusinesses(map)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(q) ||
        user.name.toLowerCase().includes(q) ||
        (businesses[user.business_id]?.name ?? '').toLowerCase().includes(q),
    )
  }, [users, search, businesses])

  if (loading) {
    return <p className="text-neutral-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <p className="text-sm text-neutral-500">
        Directorio de todos los usuarios de la plataforma. Para invitar, cambiar rol, eliminar o enviar
        recuperación, entra al negocio correspondiente.
      </p>

      <input
        type="search"
        placeholder="Buscar por nombre, email o negocio…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Negocio</th>
              <th className="px-4 py-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2">{user.name}</td>
                <td className="px-4 py-2 text-neutral-600">{user.email}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                    {user.role === 'admin' ? 'Administrador' : 'Cocina'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/super-admin/negocios/${user.business_id}`}
                    className="text-neutral-900 hover:underline"
                  >
                    {businesses[user.business_id]?.name ?? user.business_id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-500">{new Date(user.created_at).toLocaleDateString('es-ES')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
