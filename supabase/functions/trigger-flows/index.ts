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
    const { trigger_type, conversation_id, data } = await req.json()

    console.log(`🎯 Trigger recebido: ${trigger_type}`)

    // Buscar fluxos ativos para este trigger
    const { data: flows, error } = await supabase
      .from('flow_automations')
      .select('id, name, trigger_config, whatsapp_instances')
      .eq('trigger_type', trigger_type)
      .eq('is_active', true)

    if (error) throw error

    if (!flows || flows.length === 0) {
      console.log('⚠️ Nenhum fluxo ativo para este trigger')
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✅ ${flows.length} fluxo(s) encontrado(s)`)

    let triggeredCount = 0
    let messageSentByFlow = false

    for (const flow of flows) {
      const config = flow.trigger_config || {}

      // Filtro por instância WhatsApp
      if (flow.whatsapp_instances && flow.whatsapp_instances.length > 0) {
        if (!data?.instance_id || !flow.whatsapp_instances.includes(data.instance_id)) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (instância não permitida)`)
          continue
        }
      }

      // Filtro por palavras-chave (para message_received)
      if (trigger_type === 'message_received' && config.keywords) {
        const keywords = Array.isArray(config.keywords)
          ? config.keywords.map((k: string) => k.trim().toLowerCase())
          : String(config.keywords).split(',').map((k: string) => k.trim().toLowerCase())
        const messageContent = (data?.message_content || '').toLowerCase()

        const hasKeyword = keywords.some((keyword: string) => messageContent.includes(keyword))

        if (!hasKeyword) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (palavra-chave não encontrada)`)
          continue
        }
      }

      // Filtro por mudança de status
      if (trigger_type === 'status_changed') {
        if (config.from_status && config.from_status !== data?.from_status) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (from_status não bate)`)
          continue
        }
        if (config.to_status && config.to_status !== data?.to_status) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (to_status não bate)`)
          continue
        }
      }

      // Filtro por mudança de etapa
      if (trigger_type === 'stage_changed') {
        if (config.from_stage_id && config.from_stage_id !== data?.from_stage_id) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (from_stage_id não bate)`)
          continue
        }
        if (config.to_stage_id && config.to_stage_id !== data?.to_stage_id) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (to_stage_id não bate)`)
          continue
        }
      }

      // Filtro por agente atribuído
      if (trigger_type === 'agent_assigned') {
        if (config.agent_type_filter && config.agent_type_filter !== data?.agent_type) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (agent_type não bate)`)
          continue
        }
      }

      // Filtro por tag adicionada
      if (trigger_type === 'tag_added') {
        if (config.tag && config.tag !== data?.tag) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (tag não bate)`)
          continue
        }
      }

      // Filtro por mudança de prioridade
      if (trigger_type === 'priority_changed') {
        if (config.from_priority && config.from_priority !== data?.from_priority) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (from_priority não bate)`)
          continue
        }
        if (config.to_priority && config.to_priority !== data?.to_priority) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (to_priority não bate)`)
          continue
        }
      }

      // Filtro por CSAT recebido
      if (trigger_type === 'csat_received') {
        const score = data?.csat_score
        if (config.csat_min && score < config.csat_min) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (csat_score abaixo do mínimo)`)
          continue
        }
        if (config.csat_max && score > config.csat_max) {
          console.log(`⏭️ Fluxo ${flow.name} ignorado (csat_score acima do máximo)`)
          continue
        }
      }

      // conversation_closed, conversation_reopened, sla_breached, no_response_timeout
      // não precisam de filtros adicionais

      console.log(`🚀 Disparando fluxo: ${flow.name}`)

      // Executar flow e aguardar resultado (não fire & forget) para saber se
      // o flow enviou mensagem — evita que agent-executor envie resposta duplicada.
      try {
        const { data: flowResult } = await supabase.functions.invoke('flow-engine', {
          body: {
            flow_id: flow.id,
            conversation_id,
            trigger_data: data,
          },
        })
        if (flowResult?.message_sent) messageSentByFlow = true
      } catch (err: any) {
        console.error(`❌ Erro ao executar fluxo ${flow.name}:`, err)
      }

      triggeredCount++
    }

    console.log(JSON.stringify({
      level: 'info', fn: 'trigger-flows', step: 'done',
      conversation_id, triggered: triggeredCount, message_sent: messageSentByFlow
    }))

    return new Response(JSON.stringify({ success: true, triggered: triggeredCount, message_sent: messageSentByFlow }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Trigger flows error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
