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

  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('business_id, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return json({ error: 'Solo un administrador puede invitar usuarios' }, 403)
  }

  const body = await req.json().catch(() => null)
  const email = body?.email?.trim()
  const name = body?.name?.trim()
  const role = body?.role

  if (!email || !name || !VALID_ROLES.includes(role)) {
    return json({ error: 'Datos incompletos' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      business_id: callerProfile.business_id,
      name,
      role,
    },
  })

  if (error) {
    return json({ error: error.message }, 400)
  }

  return json({ user: data.user }, 200)
})
