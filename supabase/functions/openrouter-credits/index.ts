const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured')
    }

    const authHeaders = { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }

    // Call both endpoints in parallel
    const [creditsRes, keyRes] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/credits', { headers: authHeaders }),
      fetch('https://openrouter.ai/api/v1/key', { headers: authHeaders }),
    ])

    const creditsData = creditsRes.ok ? await creditsRes.json() : null
    const keyData = keyRes.ok ? await keyRes.json() : null

    if (!creditsRes.ok) {
      console.log(`[openrouter-credits] /api/v1/credits returned ${creditsRes.status} - using key fallback`)
    }

    // Extract credits info
    const totalCredits = creditsData?.data?.total_credits ?? null
    const totalUsage = creditsData?.data?.total_usage ?? null
    const balance = totalCredits != null && totalUsage != null
      ? totalCredits - totalUsage
      : keyData?.data?.limit_remaining ?? null

    // Combine both responses
    const combined = {
      // Account-level credits (priority)
      total_credits: totalCredits,
      total_usage: totalUsage,
      balance,
      // Key-level data (period usage, flags)
      ...(keyData?.data || {}),
    }

    return new Response(JSON.stringify({
      success: true,
      data: combined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[openrouter-credits] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
