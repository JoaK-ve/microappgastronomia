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

  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('business_id, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return json({ error: 'Solo un administrador puede eliminar usuarios' }, 403)
  }

  const body = await req.json().catch(() => null)
  const targetUserId = body?.userId?.trim()

  if (!targetUserId) {
    return json({ error: 'Falta el usuario a eliminar' }, 400)
  }

  if (targetUserId === userData.user.id) {
    return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Borrado real de auth.users. profiles se borra en cascada (on delete
  // cascade). El único FK que apuntaba a profiles (productions.produced_by)
  // es "on delete set null" desde el esquema original: el histórico de
  // producciones no se toca, solo pierde la atribución de quién la hizo.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId)

  if (deleteError) {
    return json({ error: deleteError.message }, 400)
  }

  return json({ success: true }, 200)
})
