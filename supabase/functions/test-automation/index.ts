import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { automation_id } = await req.json()

    console.log(`[test-automation] Testing automation ${automation_id}`)

    // Mock trigger data for testing
    const mockTriggerData = {
      conversation_id: null, // null para não afetar dados reais
      customer_name: 'Cliente Teste',
      customer_phone: '+5511999999999',
      message_content: 'Preciso de ajuda com meu boleto',
      sentiment: 'neutral',
      urgency: 'medium',
      time_of_day: new Date().toTimeString().substring(0, 5),
      status: 'active',
      handler_type: 'ai',
      rating: '4',
    }

    // Execute via automation-executor
    const { data: result, error } = await supabase.functions.invoke('automation-executor', {
      body: { automation_id, trigger_data: mockTriggerData }
    })

    if (error) throw error

    return new Response(JSON.stringify({
      test_mode: true,
      trigger_data_used: mockTriggerData,
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[test-automation] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
