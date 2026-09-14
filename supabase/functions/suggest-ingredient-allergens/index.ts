import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLERGENS = [
  'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja',
  'lacteos', 'frutos_cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos',
  'altramuces', 'moluscos',
]

const SYSTEM_PROMPT = `Eres un asistente de seguridad alimentaria para una app de gastronomía. Te doy el nombre (y a veces categoría) de UN ingrediente de cocina, y debes clasificarlo contra los 14 alérgenos de declaración obligatoria en la Unión Europea. Usa EXACTAMENTE estos identificadores: ${ALLERGENS.join(', ')}.

Reglas estrictas:
- Si el ingrediente es claramente uno de esos alérgenos o lo contiene por naturaleza (ej. "Harina de trigo" -> gluten, "Leche" -> lacteos, "Nueces" -> frutos_cascara), inclúyelo con confianza en "allergens".
- Si es un producto comercial o procesado donde el alérgeno real depende de la marca o receta exacta (salsas industriales, productos horneados comprados, mejoradores, etc.), NO lo marques como seguro en "allergens" — en su lugar, dejalo vacío o solo con lo que sea inequívoco, y explica en "note" qué debería revisar el usuario en la etiqueta real del producto.
- Nunca inventes ni asumas un alérgeno sin relación clara y directa con el ingrediente tal como está escrito.
- Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código, con esta forma exacta:
{"allergens": ["gluten"], "note": "texto breve en español o null"}`

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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'No autorizado' }, 401)
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Solo un administrador puede pedir sugerencias de alérgenos.' }, 403)
  }

  const body = await req.json().catch(() => null)
  const name = body?.name?.trim()
  const category = body?.category?.trim()

  if (!name) {
    return json({ error: 'Falta el nombre del ingrediente.' }, 400)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({ error: 'La sugerencia por IA no está configurada todavía (falta ANTHROPIC_API_KEY).' }, 503)
  }

  const userMessage = category ? `Ingrediente: "${name}" (categoría: "${category}")` : `Ingrediente: "${name}"`

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!anthropicResponse.ok) {
    return json({ error: 'No se pudo obtener la sugerencia. Inténtalo de nuevo.' }, 502)
  }

  const anthropicData = await anthropicResponse.json()
  const rawText: string = anthropicData?.content?.[0]?.text ?? ''

  let parsed: { allergens?: string[]; note?: string | null }
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
  } catch {
    return json({ error: 'La sugerencia no se pudo interpretar. Inténtalo de nuevo.' }, 502)
  }

  const allergens = (parsed.allergens ?? []).filter((a) => ALLERGENS.includes(a))

  return json({ allergens, note: parsed.note ?? null }, 200)
})
