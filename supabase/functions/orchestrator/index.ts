import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getModelConfig } from '../_shared/get-model-config.ts'
import { callOpenRouter, OpenRouterError } from '../_shared/openrouter-client.ts'
import { formatBrazilDateTime, isBusinessHours } from '../_shared/brazil-timezone.ts'
import { generateTransferContext } from '../_shared/transfer-context.ts'
import { DEFAULT_LITE_MODEL } from '../_shared/default-models.ts'

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
    const { conversation_id, message_content, analysis } = await req.json()

    // 1. Buscar conversa atual (incluindo whatsapp_instance_id e is_group para filtrar agentes)
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('current_agent_id, agent_switches_count, handler_type, whatsapp_instance_id, is_group, metadata')
      .eq('id', conversation_id)
      .single()

    // ── GROUP ROUTING: roteamento prioritário para conversas de grupo ──
    if (conversation?.is_group) {
      const { data: groupAgent } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('specialty', 'group_support')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (groupAgent) {
        console.log(`[orchestrator] Group conversation routed to group agent: ${groupAgent.name}`)

        await supabase
          .from('ai_conversations')
          .update({
            current_agent_id: groupAgent.id,
            handler_type: 'ai',
          })
          .eq('id', conversation_id)

        return new Response(JSON.stringify({
          action: 'agent',
          agent_id: groupAgent.id,
          agent_name: groupAgent.name,
          reason: 'Mensagem de grupo roteada para agente especialista',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Sem agente de grupo configurado — fallback para agente de maior prioridade
      const { data: fallbackGroupAgents } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('is_active', true)
        .neq('specialty', 'group_support')
        .order('priority', { ascending: false })
        .limit(1)

      const fallbackGroupAgent = fallbackGroupAgents?.[0]
      if (fallbackGroupAgent) {
        console.log(`[orchestrator] Group without group agent → fallback: ${fallbackGroupAgent.name}`)
        await supabase.from('ai_conversations').update({
          current_agent_id: fallbackGroupAgent.id,
          handler_type: 'ai',
        }).eq('id', conversation_id)

        return new Response(JSON.stringify({
          action: 'agent',
          agent_id: fallbackGroupAgent.id,
          agent_name: fallbackGroupAgent.name,
          reason: 'Grupo sem agente de grupo — fallback para agente de maior prioridade',
          fallback: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Nenhum agente ativo — escalonar para humano
      console.log(`[orchestrator] Group without any active agent → escalating to human`)
      await supabase.from('ai_conversations').update({ handler_type: 'human' }).eq('id', conversation_id)
      return new Response(JSON.stringify({
        action: 'human',
        reason: 'Grupo sem agentes ativos disponíveis',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── CHECK HORÁRIO COMERCIAL (usado em múltiplas decisões abaixo) ──
    const businessStatus = await isBusinessHours(supabase)

    // Se muitas trocas de agente, escalonar (mas APENAS durante expediente)
    if (conversation && (conversation.agent_switches_count || 0) >= 2) {
      if (businessStatus.isOpen) {
        console.log(`[orchestrator] Too many agent switches (${conversation.agent_switches_count}), escalating`)
        return new Response(JSON.stringify({
          action: 'human',
          reason: 'Too many agent switches'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        console.log(`[orchestrator] Too many switches but OUTSIDE business hours — keeping AI`)
      }
    }

    // Verificação de intent crítico: escalonar diretamente sem consultar LLM
    // MAS: fora do expediente, NÃO escalar — manter IA para não abandonar o cliente
    const wantsHuman = analysis?.intent === 'want_human'
    const isCriticalNegative = analysis?.sentiment === 'negative' && analysis?.urgency === 'critical'

    // Verificar se a conversa já teve interação IA antes de escalar
    const { data: convMsgCount } = await supabase
      .from('ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id)
      .eq('role', 'assistant')

    const hasHadAIInteraction = (convMsgCount as any)?.length > 0 || (conversation as any)?.ai_messages_count > 0

    if (wantsHuman && businessStatus.isOpen) {
      // Cliente pediu humano explicitamente — respeitar, mas só se já teve interação IA
      if (!hasHadAIInteraction) {
        console.log(`[orchestrator] Client wants human but NO AI interaction yet — routing to AI first to greet and understand`)
        // Não escalar — deixar a IA cumprimentar e tentar ajudar primeiro
      } else {
        const reason = 'Cliente solicitou atendimento humano explicitamente'
        console.log(`[orchestrator] Direct escalation: ${reason}`)

        await supabase
          .from('ai_conversations')
          .update({ handler_type: 'human' })
          .eq('id', conversation_id)

        return new Response(JSON.stringify({
          action: 'human',
          reason
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (isCriticalNegative && businessStatus.isOpen && hasHadAIInteraction) {
      // Sentimento crítico negativo — só escalar se já houve interação IA
      const reason = 'Sentimento crítico negativo — escalação após interação IA'
      console.log(`[orchestrator] Direct escalation: ${reason}`)

      await supabase
        .from('ai_conversations')
        .update({ handler_type: 'human' })
        .eq('id', conversation_id)

      return new Response(JSON.stringify({
        action: 'human',
        reason
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if ((wantsHuman || isCriticalNegative) && !businessStatus.isOpen) {
      console.log(`[orchestrator] Client wants human but OUTSIDE business hours (${businessStatus.reason}) — routing to best AI agent instead`)
      // Marca flag para o agent-executor saber que deve informar sobre horário
      await supabase
        .from('ai_conversations')
        .update({
          context: {
            ...(conversation?.metadata || {}),
            wants_human_outside_hours: true,
            outside_hours_reason: businessStatus.reason,
          }
        })
        .eq('id', conversation_id)
      // Continua o fluxo normal para selecionar o melhor agente IA
    }


    // 2. Buscar agentes ativos e filtrar por instância da conversa
    const { data: allAgents } = await supabase
      .from('ai_agents')
      .select('id, name, description, specialty, priority, success_rate, whatsapp_instances, channel_type')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    // Filtrar agentes elegíveis pela instância da conversa e pelo canal
    const convInstanceId = conversation?.whatsapp_instance_id || null
    const agents = (allAgents || []).filter(a => {
      // Agentes internos (copilot) NÃO devem responder ao cliente via WhatsApp
      if ((a as any).channel_type === 'internal') return false
      const agentInstances = (a.whatsapp_instances as string[]) || []
      // Se a conversa veio de uma instância WhatsApp, o agente PRECISA ter essa instância configurada
      // Agente sem nenhuma instância WhatsApp = NÃO responde em WhatsApp (deve ter pelo menos uma configurada)
      if (convInstanceId) {
        if (agentInstances.length === 0) return false
        return agentInstances.includes(convInstanceId)
      }
      // Conversas sem instância WhatsApp (ex: internas) = aceita qualquer agente
      return true
    })

    if (convInstanceId && allAgents && agents.length < allAgents.length) {
      console.log(`[orchestrator] Filtered agents by instance ${convInstanceId}: ${allAgents.length} → ${agents.length}`)
    }

    if (!agents || agents.length === 0) {
      console.log('[orchestrator] No active agents found')
      return new Response(JSON.stringify({
        action: 'human',
        reason: 'No active agents available'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── BYPASS INTELIGENTE: pular LLM para continuações de conversa ──
    // Se já tem agente ativo, handler é IA, e não há sinais de mudança de tema,
    // retornar o agente atual imediatamente sem chamar o LLM (~1-2s economia)
    const currentAgentId = conversation?.current_agent_id
    const isAiHandled = conversation?.handler_type === 'ai'
    const intent = analysis?.intent || ''
    const sentiment = analysis?.sentiment || 'neutral'
    const urgency = analysis?.urgency || 'low'

    // Sinais que indicam necessidade de re-roteamento
    const needsRerouting =
      intent === 'want_human' ||
      intent === 'escalation' ||
      intent === 'transfer_request' ||
      intent === 'billing' || intent === 'payment' || intent === 'cancellation' ||
      intent === 'purchase' || intent === 'pricing' ||
      (sentiment === 'negative' && urgency === 'critical') ||
      (sentiment === 'negative' && urgency === 'high')

    // Mapa de intents que indicam mudança clara de especialidade
    const intentToSpecialty: Record<string, string> = {
      billing: 'financial', payment: 'financial',
      cancellation: 'retention', cancel: 'retention',
      purchase: 'sales', pricing: 'sales',
      technical: 'support', bug: 'support', error: 'support',
    }

    // ── TROCA SILENCIOSA: se o intent mudou para outro especialista, redirecionar sem avisar ──
    if (currentAgentId && isAiHandled && needsRerouting && intent !== 'want_human' && intent !== 'escalation') {
      const targetSpecialty = intentToSpecialty[intent]
      if (targetSpecialty) {
        const currentAgent = agents.find(a => a.id === currentAgentId)
        // Só trocar se o agente atual NÃO é da especialidade certa
        if (currentAgent && currentAgent.specialty !== targetSpecialty) {
          const targetAgent = agents.find(a => a.specialty === targetSpecialty)
          if (targetAgent) {
            // Generate transfer context for the new agent
            const transferCtx = await generateTransferContext(supabase, conversation_id, currentAgent.name, currentAgent.specialty)

            await supabase.from('ai_conversations').update({
              current_agent_id: targetAgent.id,
              handler_type: 'ai',
              agent_switches_count: (conversation?.agent_switches_count || 0) + 1,
              transfer_context: transferCtx,
            }).eq('id', conversation_id)

            console.log(`[orchestrator] SILENT HANDOFF: ${currentAgent.name} → ${targetAgent.name} (intent: ${intent})`)

            supabase.from('ticket_ai_logs').insert({
              ticket_id: conversation_id,
              evento_tipo: 'silent_handoff',
              resposta_recebida: JSON.stringify({ from: currentAgent.name, to: targetAgent.name, intent, reason: `Troca silenciosa por mudança de tema: ${intent}` }),
              modelo_usado: 'orchestrator',
              tokens_input: 0, tokens_output: 0,
            }).then(() => {}, (e: any) => console.error('[orchestrator] silent handoff log error:', e?.message))

            return new Response(JSON.stringify({
              action: 'agent',
              agent_id: targetAgent.id,
              agent_name: targetAgent.name,
              reason: `Troca silenciosa: ${currentAgent.name} → ${targetAgent.name} (${intent})`,
              silent_handoff: true,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        }
      }
    }

    if (currentAgentId && isAiHandled && !needsRerouting) {
      const currentAgent = agents.find(a => a.id === currentAgentId)
      if (currentAgent) {
        console.log(`[orchestrator] BYPASS: Continuing with current agent "${currentAgent.name}" (no rerouting signals detected)`)
        return new Response(JSON.stringify({
          action: 'agent',
          agent_id: currentAgent.id,
          agent_name: currentAgent.name,
          reason: 'Continuação de conversa — agente mantido (bypass LLM)',
          bypassed_llm: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── ROTEAMENTO DIRETO: nova conversa sem agente → LLM decide especialista ──
    // Sem triagem intermediária — o orchestrator roteia direto para o especialista
    if (!currentAgentId) {
      console.log('[orchestrator] New conversation → direct specialist routing via LLM')
    }

    // 3. Montar prompt para o LLM decidir o roteamento (via function calling / structured output)
    const agentsList = agents.map(a =>
      `- ID: ${a.id} | Nome: ${a.name} | Especialidade: ${a.specialty || 'geral'} | Descrição: ${a.description || 'Sem descrição'}`
    ).join('\n')

    const currentAgentInfo = conversation?.current_agent_id
      ? `\nAgente atual da conversa: ${conversation.current_agent_id} (prefira manter o mesmo agente se a mensagem for relevante para ele)`
      : ''

    const systemPrompt = `Você é um orquestrador de atendimento inteligente. Analise a mensagem do cliente e escolha o especialista mais adequado usando a função route_to_agent. NÃO existe agente de triagem — roteie DIRETO para o especialista.

Agentes disponíveis:
${agentsList}
${currentAgentInfo}

Regras:
1. Escolha o especialista cuja descrição e especialidade melhor se encaixam na mensagem
2. Se o cliente já está sendo atendido e a mensagem continua no mesmo tema, mantenha o mesmo agente
3. Se o tema mudou (ex: estava em suporte e agora pergunta sobre financeiro), troque para o especialista correto — a troca é silenciosa, o cliente não precisa saber
4. Se nenhum agente for adequado ou não conseguir determinar, escolha o agente de suporte com maior prioridade
5. Se o cliente expressou raiva extrema, pediu para falar com humano ou demonstrou insatisfação severa, use agent_id vazio para escalação humana — EXCETO se estiver FORA DO EXPEDIENTE (nesse caso, escolha o agente mais adequado e continue o atendimento por IA)
6. Se o cliente mencionar cancelamento, rescisão ou encerrar contrato, escolha o agente de retenção (retention)
7. Se o cliente for novo ou mencionar primeiro acesso/como começar, escolha o agente de onboarding`

    const userPrompt = `Mensagem do cliente: "${message_content}"

Análise da mensagem:
- Intenção: ${analysis?.intent || 'não identificada'}
- Sentimento: ${analysis?.sentiment || 'neutro'}
- Urgência: ${analysis?.urgency || 'normal'}
- Horário: ${formatBrazilDateTime()}${!businessStatus.isOpen ? ' (FORA DO EXPEDIENTE)' : ''}`

    // Structured output via function calling — eliminates JSON parsing issues
    const routingTool = {
      type: 'function',
      function: {
        name: 'route_to_agent',
        description: 'Route the customer message to the most appropriate agent',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string', description: 'The ID of the selected agent, or empty string if no agent fits' },
            reason: { type: 'string', description: 'Brief reason for the routing decision' },
          },
          required: ['agent_id', 'reason'],
        },
      },
    }

    // 4. Chamar LLM via OpenRouter — modelo lido do DB (usa shared client com timeout/headers)
    const config = await getModelConfig(supabase, 'orchestrator', DEFAULT_LITE_MODEL, 0.1, 200)
    console.log(`[orchestrator] Using model: ${config.model}`)

    /** Parse routing decision from LLM result (tool_calls ou content fallback). */
    function parseRoutingResult(result: { tool_calls?: any[]; content: string | null }): { agent_id: string | null; reason: string } | null {
      const toolCall = result.tool_calls?.[0]
      if (toolCall?.function?.arguments) {
        try {
          return JSON.parse(toolCall.function.arguments)
        } catch {
          console.error('[orchestrator] Failed to parse tool call arguments')
        }
      }
      // Fallback: try to parse content as JSON (some models return content instead of tool_calls)
      const content = result.content || ''
      if (content) {
        try {
          const cleanJson = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
          return JSON.parse(cleanJson)
        } catch {
          console.error('[orchestrator] Failed to parse fallback content:', content)
        }
      }
      return null
    }

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const llmParams = {
      messages: llmMessages,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      tools: [routingTool],
      tool_choice: { type: 'function', function: { name: 'route_to_agent' } },
    }

    // Try primary model, then fallback — propagate 402 immediately (no credits)
    let decision: { agent_id: string | null; reason: string } | null = null
    const modelsToTry = config.model !== DEFAULT_LITE_MODEL
      ? [config.model, DEFAULT_LITE_MODEL]
      : [DEFAULT_LITE_MODEL]

    for (const model of modelsToTry) {
      try {
        const result = await callOpenRouter({ ...llmParams, model })
        decision = parseRoutingResult(result)
        if (decision) break
        console.warn(`[orchestrator] Model ${model} returned unparseable response, trying next`)
      } catch (err) {
        const status = err instanceof OpenRouterError ? err.status : 0
        if (status === 402) {
          console.error('[orchestrator] OpenRouter credits exhausted (402)')
          return new Response(JSON.stringify({
            action: 'human',
            reason: 'Créditos de IA esgotados — escalando para humano',
            error_code: 402,
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        console.warn(`[orchestrator] Model ${model} failed [${status}]: ${(err as Error).message}`)
      }
    }

    if (!decision) {
      // Sempre usar fallback para agente IA quando LLM falha — nunca ignorar
      if (agents.length > 0) {
        const fallback = agents[0]
        console.log(`[orchestrator] LLM failed → forcing agent fallback: ${fallback.name} (business_hours: ${businessStatus.isOpen})`)
        await supabase.from('ai_conversations').update({ current_agent_id: fallback.id, handler_type: 'ai' }).eq('id', conversation_id)
        return new Response(JSON.stringify({
          action: 'agent', agent_id: fallback.id, agent_name: fallback.name,
          reason: 'LLM routing failed — fallback para agente de maior prioridade', fallback: true, outside_business_hours: !businessStatus.isOpen
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // Nenhum agente disponível — último recurso
      return new Response(JSON.stringify({
        action: 'human',
        reason: 'LLM routing failed and no agents available'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[orchestrator] LLM decision: agent_id=${decision.agent_id}, reason=${decision.reason}`)

    // 6. Verificar se o agente escolhido existe
    if (!decision.agent_id) {
      // Fallback inteligente: tentar pelo produto do cliente, depois maior prioridade
      if (agents.length > 0) {
        // Tentar determinar produto pelo cadastro do cliente
        let fallbackAgent = null as typeof agents[0] | null
        try {
          const { data: convData } = await supabase
            .from('ai_conversations')
            .select('helpdesk_client_id')
            .eq('id', conversation_id)
            .single()
          if (convData?.helpdesk_client_id) {
            const { data: clientData } = await supabase
              .from('helpdesk_clients')
              .select('sistema')
              .eq('id', convData.helpdesk_client_id)
              .single()
            if (clientData?.sistema) {
              const productSpecialty = clientData.sistema === 'mais_simples' || clientData.sistema === 'Mais Simples'
                ? 'support_ms'
                : clientData.sistema === 'maxpro' || clientData.sistema === 'MaxPro'
                  ? 'support_maxpro'
                  : null
              if (productSpecialty) {
                fallbackAgent = agents.find(a => a.specialty === productSpecialty) || null
              }
            }
          }
        } catch (e) {
          console.warn('[orchestrator] Fallback client lookup failed:', e)
        }
        if (!fallbackAgent) fallbackAgent = agents[0] // maior prioridade
        console.log(`[orchestrator] LLM decided no agent fits ("${decision.reason}"), but using FALLBACK agent: ${fallbackAgent.name} (priority ${fallbackAgent.priority})`)

        const isSwitch = conversation?.current_agent_id && conversation.current_agent_id !== fallbackAgent.id
        await supabase
          .from('ai_conversations')
          .update({
            current_agent_id: fallbackAgent.id,
            handler_type: 'ai',
            agent_switches_count: isSwitch
              ? (conversation?.agent_switches_count || 0) + 1
              : (conversation?.agent_switches_count || 0),
          })
          .eq('id', conversation_id)

        return new Response(JSON.stringify({
          action: 'agent',
          agent_id: fallbackAgent.id,
          agent_name: fallbackAgent.name,
          reason: `Fallback automático: ${decision.reason || 'LLM não escolheu agente'}`,
          fallback: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log(`[orchestrator] LLM decided no agent fits: ${decision.reason}`)
      return new Response(JSON.stringify({
        action: 'human',
        reason: decision.reason || 'No suitable agent found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const selectedAgent = agents.find(a => a.id === decision.agent_id)
    if (!selectedAgent) {
      console.error(`[orchestrator] LLM returned unknown agent_id: ${decision.agent_id}`)
      // Fallback: usar agente de maior prioridade em vez de escalar
      if (agents.length > 0) {
        const fallback = agents[0]
        console.log(`[orchestrator] Unknown agent_id fallback → ${fallback.name}`)
        await supabase.from('ai_conversations').update({ current_agent_id: fallback.id, handler_type: 'ai' }).eq('id', conversation_id)
        return new Response(JSON.stringify({
          action: 'agent', agent_id: fallback.id, agent_name: fallback.name,
          reason: `Agente selecionado não encontrado, fallback: ${fallback.name}`, fallback: true
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        action: 'human',
        reason: 'Selected agent not found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 7. Atualizar conversa com agente selecionado
    const isSwitch = conversation?.current_agent_id && conversation.current_agent_id !== selectedAgent.id

    // Generate transfer context when switching agents
    let transferCtxLlm = undefined
    if (isSwitch) {
      const prevAgent = agents.find(a => a.id === conversation?.current_agent_id)
      if (prevAgent) {
        transferCtxLlm = await generateTransferContext(supabase, conversation_id, prevAgent.name, prevAgent.specialty)
      }
    }

    await supabase
      .from('ai_conversations')
      .update({
        current_agent_id: selectedAgent.id,
        handler_type: 'ai',
        agent_switches_count: isSwitch
          ? (conversation?.agent_switches_count || 0) + 1
          : (conversation?.agent_switches_count || 0),
        ...(transferCtxLlm ? { transfer_context: transferCtxLlm } : {}),
      })
      .eq('id', conversation_id)

    console.log(`[orchestrator] Selected agent: ${selectedAgent.name} | Reason: ${decision.reason}`)

    // Log routing decision to ticket_ai_logs (fire-and-forget)
    if (conversation_id) {
      supabase.from('ticket_ai_logs').insert({
        ticket_id: conversation_id,
        evento_tipo: 'routing',
        resposta_recebida: JSON.stringify({ agent_id: selectedAgent.id, agent_name: selectedAgent.name, reason: decision.reason }),
        modelo_usado: 'orchestrator',
        tokens_input: 0,
        tokens_output: 0,
        metadata: {
          agents_considered: agents?.length || 0,
          is_switch: isSwitch,
        },
      }).then(() => {}, (e: any) => console.error('[orchestrator] ticket_ai_logs insert error:', e?.message))
    }

    return new Response(JSON.stringify({
      action: 'agent',
      agent_id: selectedAgent.id,
      agent_name: selectedAgent.name,
      reason: decision.reason
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[orchestrator] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
