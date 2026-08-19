import { createClient } from 'jsr:@supabase/supabase-js@2'

const VALID_ROLES = ['admin', 'kitchen']

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

  // is_super_admin() es security definer: esta llamada funciona igual
  // tanto si el que llama tiene fila en profiles como si no.
  const { data: isSuperAdminData } = await callerClient.rpc('is_super_admin')
  const isSuperAdmin = isSuperAdminData === true

  const body = await req.json().catch(() => null)
  const email = body?.email?.trim()
  const name = body?.name?.trim()
  const role = body?.role
  const origin = body?.origin?.trim()

  if (!email || !name || !VALID_ROLES.includes(role)) {
    return json({ error: 'Datos incompletos' }, 400)
  }

  let targetBusinessId: string

  if (isSuperAdmin) {
    // El Super Admin no pertenece a ningún negocio: el destino viene
    // explícito en el body, pero se verifica que existe de verdad antes
    // de confiar en él (la policy "super admin select all businesses" ya
    // permite esta consulta).
    const requestedBusinessId = body?.business_id?.trim()
    if (!requestedBusinessId) {
      return json({ error: 'Falta el negocio destino' }, 400)
    }
    const { data: businessCheck } = await callerClient
      .from('businesses')
      .select('id')
      .eq('id', requestedBusinessId)
      .single()
    if (!businessCheck) {
      return json({ error: 'Negocio no encontrado' }, 404)
    }
    targetBusinessId = requestedBusinessId
  } else if (callerProfile?.role === 'admin') {
    targetBusinessId = callerProfile.business_id
  } else {
    return json({ error: 'Solo un administrador puede invitar usuarios' }, 403)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      business_id: targetBusinessId,
      name,
      role,
    },
    redirectTo: origin ? `${origin}/invitacion` : undefined,
  })

  if (error) {
    return json({ error: error.message }, 400)
  }

  if (isSuperAdmin) {
    await adminClient.from('platform_audit_log').insert({
      actor_id: userData.user.id,
      business_id: targetBusinessId,
      target_user_id: data.user?.id ?? null,
      action: 'user_invited',
      detail: { email, name, role },
    })
  }

  return json({ user: data.user }, 200)
})
