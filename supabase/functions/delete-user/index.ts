import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'No autorizado' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'No autorizado' }, 401)
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('business_id, role')
    .eq('id', userData.user.id)
    .single()

  const { data: isSuperAdminData } = await callerClient.rpc('is_super_admin')
  const isSuperAdmin = isSuperAdminData === true

  const body = await req.json().catch(() => null)
  const targetUserId = body?.userId?.trim()

  if (!targetUserId) {
    return json({ error: 'Falta el usuario a eliminar' }, 400)
  }

  if (targetUserId === userData.user.id) {
    return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  let targetBusinessId: string
  let targetEmail: string | null = null
  let targetName: string | null = null

  if (isSuperAdmin) {
    // El Super Admin puede actuar sobre cualquier negocio: se consulta
    // con la service key porque no hay business_id propio con el que
    // acotar la búsqueda como en la rama de admin normal.
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('business_id, role, email, name')
      .eq('id', targetUserId)
      .single()

    if (!targetProfile) {
      return json({ error: 'Usuario no encontrado' }, 404)
    }

    // Condición de seguridad aprobada explícitamente: nunca dejar un
    // negocio sin ningún ADMIN. Se comprueba en el backend, no solo en
    // la UI, usando la misma fuente de verdad que super_admin_set_user_role.
    if (targetProfile.role === 'admin') {
      const { data: remainingAdmins } = await adminClient.rpc('business_admin_count', {
        p_business_id: targetProfile.business_id,
        p_exclude_user_id: targetUserId,
      })
      if (!remainingAdmins || remainingAdmins === 0) {
        return json(
          { error: 'No se puede eliminar: es el único administrador del negocio. Invita o asciende a otro administrador primero.' },
          400,
        )
      }
    }

    targetBusinessId = targetProfile.business_id
    targetEmail = targetProfile.email
    targetName = targetProfile.name
  } else {
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo un administrador puede eliminar usuarios' }, 403)
    }

    // callerClient está sujeto a RLS ("select profiles in own business"), así
    // que esta consulta ya no encuentra nada si el usuario objetivo es de
    // otro negocio — igual comparamos business_id de forma explícita debajo,
    // como defensa adicional, sin confiar únicamente en RLS para este caso.
    const { data: targetProfile, error: targetError } = await callerClient
      .from('profiles')
      .select('business_id')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return json({ error: 'Usuario no encontrado' }, 404)
    }

    if (targetProfile.business_id !== callerProfile.business_id) {
      return json({ error: 'No autorizado' }, 403)
    }

    targetBusinessId = targetProfile.business_id
  }

  // Borrado real de auth.users. profiles se borra en cascada (on delete
  // cascade). El único FK que apuntaba a profiles (productions.produced_by)
  // es "on delete set null" desde el esquema original: el histórico de
  // producciones no se toca, solo pierde la atribución de quién la hizo.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId)

  if (deleteError) {
    return json({ error: deleteError.message }, 400)
  }

  if (isSuperAdmin) {
    // target_user_id se deja en null a propósito: la fila de auth.users
    // que referenciaría ya no existe (se acaba de borrar arriba), y esa
    // columna tiene una FK contra auth.users — insertarla igual violaría
    // la restricción y el registro de auditoría fallaría en silencio. El
    // id/email/nombre del usuario eliminado quedan en detail en su lugar.
    await adminClient.from('platform_audit_log').insert({
      actor_id: userData.user.id,
      business_id: targetBusinessId,
      target_user_id: null,
      action: 'user_deleted',
      detail: { deleted_user_id: targetUserId, email: targetEmail, name: targetName },
    })
  }

  return json({ success: true }, 200)
})
