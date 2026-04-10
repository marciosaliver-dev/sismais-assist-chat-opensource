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
    const { conversation_id, message_id, agent_id, confidence } = await req.json()

    console.log(`[learning-loop] Processing feedback for conversation ${conversation_id}, agent ${agent_id}`)

    // 1. Buscar mensagem original do agente
    let originalResponse: string | null = null
    if (message_id) {
      const { data: msg } = await supabase
        .from('ai_messages')
        .select('content')
        .eq('id', message_id)
        .single()
      originalResponse = msg?.content || null
    }

    // 2. Verificar se conversa foi escalada para humano (= IA falhou)
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('handler_type, status')
      .eq('id', conversation_id)
      .single()

    if (conversation?.handler_type === 'human') {
      console.log(`[learning-loop] Conversation was escalated to human - recording negative feedback`)
      
      await supabase.from('ai_learning_feedback').insert({
        conversation_id,
        message_id,
        agent_id,
        feedback_type: 'not_helpful',
        feedback_source: 'system_escalation',
        original_response: originalResponse,
        learning_action: 'increase_threshold'
      })

      // Aumentar confidence_threshold do agente (+5%)
      if (agent_id) {
        await supabase.rpc('adjust_agent_confidence', {
          p_agent_id: agent_id,
          p_adjustment: 0.05
        })
        console.log(`[learning-loop] Agent ${agent_id} confidence threshold increased by 5%`)
      }

      return new Response(JSON.stringify({ success: true, action: 'threshold_increased' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Verificar se houve CSAT rating
    if (conversation?.status === 'resolved') {
      const { data: convWithCsat } = await supabase
        .from('ai_conversations')
        .select('csat_rating, csat_feedback')
        .eq('id', conversation_id)
        .single()

      if (convWithCsat?.csat_rating) {
        const isPositive = convWithCsat.csat_rating >= 4

        await supabase.from('ai_learning_feedback').insert({
          conversation_id,
          message_id,
          agent_id,
          feedback_type: isPositive ? 'helpful' : 'not_helpful',
          feedback_source: 'csat',
          original_response: originalResponse,
          learning_action: isPositive ? 'decrease_threshold' : 'increase_threshold'
        })

        if (agent_id) {
          if (isPositive) {
            await supabase.rpc('adjust_agent_confidence', {
              p_agent_id: agent_id,
              p_adjustment: -0.02
            })
            await supabase.rpc('increment_agent_success', { p_agent_id: agent_id })
            console.log(`[learning-loop] Agent ${agent_id} rewarded (CSAT: ${convWithCsat.csat_rating})`)

            // Auto-extract knowledge from high-quality conversations
            supabase.functions.invoke('extract-conversation-knowledge', {
              body: { conversation_id, agent_id }
            }).catch(e => console.error('[learning-loop] Knowledge extraction failed:', e))
          } else {
            await supabase.rpc('adjust_agent_confidence', {
              p_agent_id: agent_id,
              p_adjustment: 0.03
            })
            console.log(`[learning-loop] Agent ${agent_id} penalized (CSAT: ${convWithCsat.csat_rating})`)
          }
        }
      }
    }

    // 4. Analisar próxima mensagem do cliente para feedback implícito
    if (message_id) {
      const { data: agentMsg } = await supabase
        .from('ai_messages')
        .select('created_at')
        .eq('id', message_id)
        .single()

      if (agentMsg) {
        const { data: nextMessages } = await supabase
          .from('ai_messages')
          .select('content, sentiment')
          .eq('conversation_id', conversation_id)
          .eq('role', 'user')
          .gt('created_at', agentMsg.created_at)
          .order('created_at', { ascending: true })
          .limit(1)

        if (nextMessages && nextMessages.length > 0) {
          const nextMessage = nextMessages[0]
          const positiveWords = ['obrigado', 'obrigada', 'valeu', 'ajudou', 'resolveu', 'perfeito', 'ótimo', 'excelente', 'maravilha', 'top', 'show']
          const isPositive = positiveWords.some(w =>
            nextMessage.content.toLowerCase().includes(w)
          ) || nextMessage.sentiment === 'positive'

          if (isPositive && agent_id) {
            await supabase.from('ai_learning_feedback').insert({
              conversation_id,
              message_id,
              agent_id,
              feedback_type: 'helpful',
              feedback_source: 'implicit_positive',
              original_response: originalResponse,
              user_message: nextMessage.content,
              learning_action: 'decrease_threshold'
            })

            await supabase.rpc('adjust_agent_confidence', {
              p_agent_id: agent_id,
              p_adjustment: -0.02
            })
            await supabase.rpc('increment_agent_success', { p_agent_id: agent_id })
            console.log(`[learning-loop] Implicit positive feedback detected for agent ${agent_id}`)

            // Auto-extract knowledge from positive conversations
            supabase.functions.invoke('extract-conversation-knowledge', {
              body: { conversation_id, agent_id }
            }).catch(e => console.error('[learning-loop] Knowledge extraction failed:', e))
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[learning-loop] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
