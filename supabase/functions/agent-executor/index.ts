import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getModelConfig, getModelPricing, calculateCost } from '../_shared/get-model-config.ts'
import { callOpenRouter, callOpenRouterWithFallback, ChatResult, OpenRouterError } from '../_shared/openrouter-client.ts'
import { logActionAsync } from "../_shared/action-logger.ts"
import { handleDeadLetter } from "../_shared/dead-letter.ts"
import { formatBrazilDateTime, isBusinessHours, getNextBusinessDay, getGreetingByTime } from '../_shared/brazil-timezone.ts'
import { detectLoop } from '../_shared/loop-detector.ts'
import { trackMetric, trackError } from '../_shared/pipeline-metrics.ts'
import { FLAGS } from '../_shared/feature-flags.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'
import { cachedQuery } from '../_shared/cache.ts'

function extractReasoning(rawContent: string): { content: string; reasoning: string | null } {
  const match = rawContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)
  if (!match) return { content: rawContent.trim(), reasoning: null }

  const reasoning = match[1].trim().slice(0, 2000)
  const content = rawContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim()
  return { content, reasoning }
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
    const body = await req.json()
    const { conversation_id, agent_id, message_content, analysis, mode, conversation_history, persona, extra_system_prompt } = body
    const isPlayground = mode === 'playground'

    // Loop cooldown check — skip LLM if conversation is in cooldown
    if (!isPlayground && conversation_id) {
      const { data: cooldownCheck } = await supabase
        .from('ai_conversations')
        .select('metadata')
        .eq('id', conversation_id)
        .single()
      const cooldownUntil = (cooldownCheck?.metadata as any)?.loop_cooldown_until
      if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
        console.log(`[agent-executor] Loop cooldown active until ${cooldownUntil} — skipping LLM`)
        return new Response(JSON.stringify({
          action: 'escalate',
          reason: 'Conversa em cooldown por detecção de loop — aguardando atendente humano',
          confidence: 0.1,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // 1. Buscar configuração do agente
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (!agent) {
      throw new Error(`Agent ${agent_id} not found`)
    }

    console.log(`[agent-executor] Executing agent: ${agent.name} (configured model: ${agent.model || 'fallback'})${isPlayground ? ' [PLAYGROUND]' : ''}`)

    const startTime = Date.now()

    // 1b. Fetch guardrails, skills, and prompt methods in parallel (all independent of conversation data)
    const [{ data: guardrails }, rawSkillAssignments, rawPromptMethods] = await Promise.all([
      supabase
        .from('ai_guardrails')
        .select('*')
        .or(`agent_id.is.null,agent_id.eq.${agent_id}`)
        .eq('is_active', true)
        .order('created_at'),
      !isPlayground
        ? cachedQuery(`skills:${agent_id}`, 5 * 60_000, () =>
            supabase
              .from('ai_agent_skill_assignments')
              .select('priority, custom_prompt_override, is_enabled, ai_agent_skills(name, prompt_instructions, auto_activate, trigger_keywords, trigger_intents)')
              .eq('agent_id', agent_id)
              .eq('is_enabled', true)
              .order('priority', { ascending: true })
              .then(r => r.data)
          )
        : Promise.resolve(null),
      !isPlayground && (agent.prompt_methods as string[] || []).length > 0
        ? cachedQuery(`methods:${agent_id}`, 5 * 60_000, () =>
            supabase
              .from('ai_prompt_methods')
              .select('name, label, prompt_template')
              .in('name', agent.prompt_methods as string[])
              .eq('is_active', true)
              .order('sort_order', { ascending: true })
              .then(r => r.data)
          )
        : Promise.resolve(null),
    ])

    const globalRules = (guardrails || []).filter((g: any) => !g.agent_id)
    const agentRules = (guardrails || []).filter((g: any) => g.agent_id)

    // Build guardrails section for system prompt
    let guardrailsPrompt = ''
    if (guardrails && guardrails.length > 0) {
      guardrailsPrompt = '\n\n## REGRAS INVIOLÁVEIS (Guardrails)\nEstas regras têm prioridade sobre qualquer outra instrução.\n'
      if (globalRules.length > 0) {
        guardrailsPrompt += '\n### Regras Globais\n'
        globalRules.forEach((r: any, i: number) => { guardrailsPrompt += `${i + 1}. ${r.rule_content}\n` })
      }
      if (agentRules.length > 0) {
        guardrailsPrompt += '\n### Regras do Agente\n'
        agentRules.forEach((r: any, i: number) => { guardrailsPrompt += `${i + 1}. ${r.rule_content}\n` })
      }
      guardrailsPrompt += '\n### Protocolo Anti-Alucinação\n- NUNCA invente informações, dados, links, números de telefone, valores ou procedimentos.\n- Se não tiver certeza absoluta, diga: "Vou verificar essa informação e retorno em breve."\n- SEMPRE baseie suas respostas na base de conhecimento fornecida. Se não encontrar a informação, diga que não possui essa informação no momento.\n- Prefira transferir para um humano a dar informação potencialmente incorreta.\n- Quando citar dados do cliente (valores, contratos, datas), use APENAS os dados fornecidos no contexto [DADOS DO CLIENTE VINCULADO].\n- PROIBIDO criar URLs, links ou referências que não existam na base de conhecimento.\n- PROIBIDO inventar números de telefone, emails ou contatos comerciais. Se o cliente pedir um contato que não está na base de conhecimento, diga que vai verificar e encaminhe para um atendente humano.\n'
      guardrailsPrompt += '\n### Proteção de Dados (LGPD)\n- NUNCA inclua CPF, CNPJ, números de cartão de crédito ou dados bancários completos na sua resposta.\n- Se precisar referenciar um documento, mostre apenas os últimos 4 dígitos (ex: "***.***.***-34").\n- NUNCA repita dados sensíveis que o cliente enviar — apenas confirme que recebeu.\n'
      console.log(`[agent-executor] Injected ${guardrails.length} guardrails (${globalRules.length} global, ${agentRules.length} agent-specific)`)
    }

    // 2. Buscar histórico + dados da conversa em paralelo
    let historyMessages: Array<{ role: string; content: string }> = []
    let conversationData: { helpdesk_client_id?: string; whatsapp_instance_id?: string; started_at?: string; kanban_board_id?: string } | null = null

    let conversationSummary: string | null = null

    if (isPlayground && conversation_history) {
      historyMessages = conversation_history
    } else if (conversation_id) {
      // ── PARALELO: Histórico recente + dados da conversa + resumo simultaneamente ──
      const [historyResult, convResult] = await Promise.all([
        supabase
          .from('ai_messages')
          .select('role, content')
          .eq('conversation_id', conversation_id)
          .not('intent', 'eq', 'summarization')
          .not('role', 'eq', 'system')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('ai_conversations')
          .select('helpdesk_client_id, whatsapp_instance_id, started_at, kanban_board_id, conversation_summary, summary_last_message_id')
          .eq('id', conversation_id)
          .single(),
      ])

      if (historyResult.data) {
        // Reverse to get chronological order (we fetched desc for "last N")
        historyMessages = historyResult.data.reverse().map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }))
      }
      conversationData = convResult.data
      conversationSummary = (convResult.data as any)?.conversation_summary || null

      // Trigger summarization when conversation is long enough (with timeout to avoid hanging)
      const totalMsgCount = historyResult.data?.length || 0
      if (totalMsgCount >= 40 && !conversationSummary) {
        // Await summarization with timeout — don't let it block the response indefinitely
        const SUMMARIZATION_TIMEOUT_MS = 8000
        try {
          const summarizePromise = supabase.functions.invoke('summarize-conversation', {
            body: { conversation_id }
          })
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Summarization timeout')), SUMMARIZATION_TIMEOUT_MS)
          )
          await Promise.race([summarizePromise, timeoutPromise])
          // Re-fetch the summary after synchronous summarization
          const { data: updatedConv } = await supabase
            .from('ai_conversations')
            .select('conversation_summary')
            .eq('id', conversation_id)
            .single()
          conversationSummary = updatedConv?.conversation_summary || null
          console.log(`[agent-executor] Synchronous summarization completed (${conversationSummary?.length || 0} chars)`)
        } catch (e: any) {
          console.warn(`[agent-executor] Summarization failed/timed out (${SUMMARIZATION_TIMEOUT_MS}ms):`, e?.message)
          // Fire background summarization so it's ready for next message
          supabase.functions.invoke('summarize-conversation', {
            body: { conversation_id }
          }).catch(() => {})
        }
      } else if (totalMsgCount >= 30 && conversationSummary) {
        // Background refresh of existing summary
        supabase.functions.invoke('summarize-conversation', {
          body: { conversation_id }
        }).catch((e: any) => console.warn('[agent-executor] Background summarization refresh failed:', e?.message))
      }

      // === MEMORY: Buscar memórias relevantes da conversa ===
      let memoryContext = ''
      if (conversation_id) {
        try {
          const { data: memories } = await supabase.rpc('get_conversation_memory', {
            p_conversation_id: conversation_id,
            p_memory_types: null,
            p_min_importance: 0.5,
            p_limit: 20
          })
          if (memories && memories.length > 0) {
            const memoryLines = memories.map((m: any) => `[${m.memory_type}]: ${m.content}`).join('\n')
            memoryContext = `\n\n[MEMÓRIAS DA CONVERSA]:\n${memoryLines}`
            console.log(`[agent-executor] Loaded ${memories.length} conversation memories`)
          }
        } catch (memErr) {
          console.warn('[agent-executor] Failed to load conversation memories:', memErr)
        }

        // Buscar memórias do cliente
        if (conversationData?.helpdesk_client_id) {
          try {
            const { data: clientMemories } = await supabase.rpc('get_customer_memory', {
              p_client_id: conversationData.helpdesk_client_id,
              p_memory_types: null,
              p_min_confidence: 0.6,
              p_limit: 10
            })
            if (clientMemories && clientMemories.length > 0) {
              const clientMemoryLines = clientMemories.map((m: any) => `[${m.memory_type}]: ${m.content}`).join('\n')
              memoryContext += `\n\n[MEMÓRIAS DO CLIENTE]:\n${clientMemoryLines}`
              console.log(`[agent-executor] Loaded ${clientMemories.length} client memories`)
            }
          } catch (clientMemErr) {
            console.warn('[agent-executor] Failed to load client memories:', clientMemErr)
          }
        }
      }
    }

    // Buscar dados do cliente vinculado para contexto
    let clientContext = ''
    let linkedClient: { name?: string; company_name?: string; email?: string; phone?: string; cnpj?: string; cpf?: string; subscribed_product?: string; notes?: string; license_status?: string; debt_total?: number; mrr_total?: number; churn_risk?: boolean; sistema?: string; plan_level?: string } | null = null
    if (conversationData?.helpdesk_client_id) {
      const [clientResult, prevTicketsResult] = await Promise.all([
        supabase
          .from('helpdesk_clients')
          .select('name, company_name, email, phone, cnpj, cpf, subscribed_product, notes, license_status, debt_total, mrr_total, churn_risk, sistema, plan_level')
          .eq('id', conversationData.helpdesk_client_id)
          .single(),
        supabase
          .from('ai_conversations')
          .select('id, ticket_number, ticket_subject, status, resolution_summary, conversation_summary, created_at')
          .eq('helpdesk_client_id', conversationData.helpdesk_client_id)
          .neq('id', conversation_id)
          .order('created_at', { ascending: false })
          .limit(5)
      ])

      const client = clientResult.data
      linkedClient = client
      if (client) {
        const parts = [`Nome: ${client.name}`]
        if (client.company_name) parts.push(`Empresa: ${client.company_name}`)
        if (client.cnpj) parts.push(`CNPJ: ${client.cnpj}`)
        if (client.cpf) parts.push(`CPF: ${client.cpf}`)
        if (client.email) parts.push(`Email: ${client.email}`)
        if (client.phone) parts.push(`Telefone: ${client.phone}`)
        if (client.subscribed_product) parts.push(`Produto: ${client.subscribed_product}`)
        if (client.notes) parts.push(`Observações: ${client.notes}`)
        if (client.sistema) parts.push(`Sistema: ${client.sistema}`)
        if (client.plan_level) parts.push(`Plano: ${client.plan_level}`)
        if (client.license_status) parts.push(`Status licença: ${client.license_status}`)
        if (client.mrr_total && client.mrr_total > 0) parts.push(`MRR: R$ ${client.mrr_total.toFixed(2)}`)
        if (agent.specialty !== 'triage' && client.debt_total && client.debt_total > 0) parts.push(`⚠️ Dívida: R$ ${client.debt_total.toFixed(2)}`)
        if (agent.specialty !== 'triage' && client.churn_risk) parts.push(`⚠️ Risco de churn detectado`)
        clientContext = `\n\n[DADOS DO CLIENTE VINCULADO]:\n${parts.join('\n')}\nUse esses dados no contexto da conversa. NÃO peça dados que já possui.`
      }

      const prevTickets = prevTicketsResult.data
      if (prevTickets && prevTickets.length > 0) {
        const ticketLines = prevTickets.map((t: any) => {
          let line = `• #${t.ticket_number} — ${t.ticket_subject || 'Sem assunto'} (${t.status})`
          if (t.resolution_summary) line += ` → ${t.resolution_summary}`
          if (t.conversation_summary) line += `\n  Resumo da conversa: ${t.conversation_summary}`
          return line
        }).join('\n')
        clientContext += `\n\n[HISTÓRICO DE ATENDIMENTOS DO CLIENTE]:\n${ticketLines}\nUse esse histórico para entender padrões e dar contexto ao atendimento atual. Se o cliente mencionar algo relacionado a um atendimento anterior, use o resumo para continuar de onde parou.`

        // Buscar últimas mensagens da conversa mais recente para contexto detalhado
        const mostRecentTicket = prevTickets[0]
        if (mostRecentTicket && ['finalizado', 'resolvido'].includes(mostRecentTicket.status)) {
          const { data: recentMsgs } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('conversation_id', mostRecentTicket.id)
            .not('role', 'eq', 'system')
            .not('intent', 'eq', 'summarization')
            .order('created_at', { ascending: false })
            .limit(10)
          if (recentMsgs && recentMsgs.length > 0) {
            const msgLines = recentMsgs.reverse().map((m: any) =>
              `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${(m.content || '').slice(0, 200)}`
            ).join('\n')
            clientContext += `\n\n[ÚLTIMAS MENSAGENS DO ATENDIMENTO ANTERIOR #${mostRecentTicket.ticket_number}]:\n${msgLines}\nUse esse contexto se o cliente retomar o mesmo assunto.`
          }
        }
      }
    }

    // === GL License Check: verificar elegibilidade de suporte ===
    let glSupportEligible = true // fallback: permitir se não encontrar
    let glBlockReasons: string[] = []
    let glLicenses: any[] = []

    try {
      const clientPhone = linkedClient?.phone
      const clientDoc = linkedClient?.cnpj || linkedClient?.cpf
      const clientEmail = linkedClient?.email

      if (clientPhone || clientDoc || clientEmail) {
        const GL_TIMEOUT_MS = 5000
        const glPromise = supabase.rpc('gl_search_licenses', {
          p_phone: clientPhone || null,
          p_cpf_cnpj: clientDoc || null,
          p_email: clientEmail || null,
        })
        const glTimeout = new Promise((resolve) =>
          setTimeout(() => resolve({ data: null, error: 'timeout' }), GL_TIMEOUT_MS)
        )
        const { data: glData } = await Promise.race([glPromise, glTimeout]) as any

        if (glData && glData.length > 0) {
          glLicenses = glData
          glSupportEligible = glData.some((l: any) => l.support_eligible)
          glBlockReasons = glData
            .filter((l: any) => !l.support_eligible && l.block_reason)
            .map((l: any) => {
              const sysName = l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro'
              return `${sysName}: ${l.block_reason}`
            })
          console.log(`[agent-executor] GL license check: ${glLicenses.length} licenses found, eligible=${glSupportEligible}`)
        }
      }
    } catch (glErr) {
      console.error('[agent-executor] GL license check error:', glErr)
      // Fallback: permitir suporte se GL estiver indisponível
    }

    // Inject GL license status into client context
    if (!glSupportEligible) {
      if (agent.specialty === 'triage') {
        clientContext += `\n\n[STATUS CLIENTE]: Este cliente possui pendências financeiras. Encaminhe para Kira (financial) sem mencionar valores ou dívidas.`
      } else {
        const glStatusSummary = glLicenses
          .map((l: any) => `- ${l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro'}: ${l.status_pessoa}`)
          .join('\n')

        clientContext += `\n\n[⚠️ BLOQUEIO DE SUPORTE - LICENÇA SISMAIS GL]
Este cliente NÃO tem direito a suporte técnico.
${glStatusSummary}
Motivos:
${glBlockReasons.map(r => '- ' + r).join('\n')}

INSTRUÇÃO OBRIGATÓRIA:
1. Informe ao cliente de forma educada que ele não possui suporte ativo no momento
2. Explique o motivo específico (inadimplência, plano gratuito, cancelamento, etc.)
3. Oriente como regularizar a situação
4. Transfira o atendimento para um agente humano usando a ferramenta transfer_to_human

Você NÃO PODE fornecer suporte técnico ao produto.
Você PODE responder perguntas sobre como regularizar a situação, planos e faturas.`
      }
    } else if (glLicenses.length > 0) {
      const glStatusSummary = glLicenses
        .map((l: any) => `${l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro'}: ${l.status_pessoa}`)
        .join(', ')
      clientContext += `\n\n[STATUS GL]: Cliente com suporte autorizado. Licenças: ${glStatusSummary}`
    }

    // 3. BUSCAR NA BASE DE CONHECIMENTO (RAG)
    let ragDocuments: Array<{ id: string; title: string; content: string; similarity: number; updated_at?: string }> = []

    // Resolve client's product for RAG filtering
    let clientProductId: string | null = null
    const knowledgeFilter = (agent.knowledge_base_filter as { categories?: string[]; tags?: string[]; products?: string[] }) || {}

    // Reutiliza linkedClient já buscado (evita query duplicada)
    if (agent.rag_enabled && conversation_id && !isPlayground && linkedClient?.subscribed_product) {
      try {
        const slug = linkedClient.subscribed_product.replace(/_/g, '-')
        const { data: kp } = await supabase
          .from('knowledge_products')
          .select('id')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle()

        if (kp) {
          clientProductId = kp.id
          console.log(`[agent-executor] Client product resolved: ${slug} -> ${kp.id}`)
        }
      } catch (e) {
        console.warn('[agent-executor] Failed to resolve client product:', e)
      }
    }

    // If agent has specific product filters, use those; otherwise use client's product
    const agentProductIds = knowledgeFilter.products || []
    const ragProductId = agentProductIds.length > 0 ? null : clientProductId

    if (agent.rag_enabled && analysis?.embedding) {
      const useHybrid = FLAGS.RAG_HYBRID_SEARCH && message_content
      console.log(`[agent-executor] RAG enabled (hybrid: ${useHybrid}), searching knowledge base...${ragProductId ? ` (product: ${ragProductId})` : ''}`)

      let ragData: any[] | null = null
      let ragError: any = null

      if (useHybrid) {
        const result = await supabase.rpc('search_knowledge_hybrid', {
          query_embedding: JSON.stringify(analysis.embedding),
          query_text: message_content,
          match_threshold: agent.rag_similarity_threshold || 0.75,
          match_count: agent.rag_top_k || 5,
          filter_category: null,
          filter_tags: null,
          filter_product_id: ragProductId,
          vector_weight: 0.6,
          text_weight: 0.4,
        })
        ragData = result.data
        ragError = result.error
      } else {
        // Use quality-adjusted search if available (falls back to regular search)
        const qualityResult = await supabase.rpc('search_knowledge_with_quality', {
          query_embedding: JSON.stringify(analysis.embedding),
          match_threshold: agent.rag_similarity_threshold || 0.75,
          match_count: agent.rag_top_k || 5,
          filter_category: null,
          filter_tags: null,
          filter_product_id: ragProductId
        });
        
        if (qualityResult.data && qualityResult.data.length > 0) {
          ragData = qualityResult.data;
          ragError = qualityResult.error;
          console.log(`[agent-executor] Using quality-adjusted RAG (${ragData.length} docs)`);
        } else {
          // Fallback to regular search
          const result = await supabase.rpc('search_knowledge', {
            query_embedding: JSON.stringify(analysis.embedding),
            match_threshold: agent.rag_similarity_threshold || 0.75,
            match_count: agent.rag_top_k || 5,
            filter_category: null,
            filter_tags: null,
            filter_product_id: ragProductId
          })
          ragData = result.data;
          ragError = result.error;
          console.log(`[agent-executor] Using regular RAG (${ragData?.length || 0} docs)`);
        }
      }

      if (ragError) {
        console.error('[agent-executor] RAG search error:', ragError)
      } else if (ragData && ragData.length > 0) {
        // Enrich RAG results with updated_at for recency context
        const docIds = ragData.map((d: { id: string }) => d.id)
        const { data: docDates } = await supabase
          .from('ai_knowledge_base')
          .select('id, updated_at')
          .in('id', docIds)

        const dateMap = new Map<string, string>()
        if (docDates) {
          for (const d of docDates) {
            dateMap.set(d.id, d.updated_at || '')
          }
        }

        ragDocuments = ragData.map((d: any) => ({
          ...d,
          updated_at: dateMap.get(d.id) || ''
        }))
        console.log(`[agent-executor] Found ${ragDocuments.length} RAG documents`)
      }
    }

    // 4. Montar contexto RAG com datas para priorização por recência
    const formatDate = (iso: string) => {
      if (!iso) return 'N/A'
      const d = new Date(iso)
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }

    const ragContext = ragDocuments.length > 0
      ? `\n\n--- BASE DE CONHECIMENTO ---\nIMPORTANTE: Se houver informações conflitantes ou duplicadas entre as fontes, SEMPRE priorize a fonte com data mais recente.\n\n${ragDocuments.map((doc, i) =>
          `[Fonte ${i + 1}: ${doc.title} | Atualizado: ${formatDate(doc.updated_at || '')} | Relevância: ${((doc.similarity || 0) * 100).toFixed(0)}%]\n${doc.content.substring(0, 1500)}`
        ).join('\n\n')}\n--- FIM DA BASE ---`
      : ''

    // 4b. Processar skills ativas do agente (já buscadas em paralelo no passo 1b)
    let skillsPrompt = ''
    if (!isPlayground) {
      try {
        const skillAssignments = rawSkillAssignments

        if (skillAssignments && skillAssignments.length > 0) {
          const messageWords = (message_content || '').toLowerCase().split(/\s+/)
          const messageIntent = analysis?.intent || ''

          const activeSkills = skillAssignments.filter((sa: any) => {
            const skill = sa.ai_agent_skills
            if (!skill) return false
            // Auto-activate skills always included
            if (skill.auto_activate) return true
            // Check keyword triggers
            const keywords = (skill.trigger_keywords || []) as string[]
            if (keywords.length > 0 && keywords.some((kw: string) => messageWords.includes(kw.toLowerCase()))) return true
            // Check intent triggers
            const intents = (skill.trigger_intents || []) as string[]
            if (intents.length > 0 && intents.includes(messageIntent)) return true
            return false
          })

          if (activeSkills.length > 0) {
            const skillBlocks = activeSkills.map((sa: any) => {
              const skill = sa.ai_agent_skills
              const instructions = sa.custom_prompt_override || skill.prompt_instructions
              return `### ${skill.name}\n${instructions}`
            })
            skillsPrompt = `\n\n## HABILIDADES (SKILLS) ATIVAS\n${skillBlocks.join('\n\n')}`
            console.log(`[agent-executor] Injected ${activeSkills.length} active skills: ${activeSkills.map((s: any) => s.ai_agent_skills?.name).join(', ')}`)
          }
        }
      } catch (err) {
        console.warn('[agent-executor] Skills fetch error:', err)
      }
    }

    // 4c. Inject prompt methods (já buscados em paralelo no passo 1b)
    let methodsPrompt = ''
    if (!isPlayground) {
      try {
        const methods = rawPromptMethods
        if (methods && methods.length > 0) {
          const methodBlocks = methods.map((m: any) =>
            `### ${m.label}\n${m.prompt_template}`
          )
          methodsPrompt = `\n\n## MÉTODOS DE RACIOCÍNIO\n${methodBlocks.join('\n\n')}`
          console.log(`[agent-executor] Injected ${methods.length} prompt methods: ${methods.map((m: any) => m.name).join(', ')}`)
        }
      } catch (err) {
        console.warn('[agent-executor] Methods fetch error:', err)
      }
    }

    // 5. Montar mensagens para LLM
    const RECENCY_INSTRUCTION = '\n\n[POLÍTICA DE DADOS]: Quando encontrar informações duplicadas ou conflitantes na base de conhecimento, SEMPRE priorize as informações mais recentes (data mais recente).'

    const HUMANIZATION_INSTRUCTION = `\n\n[COMPORTAMENTO HUMANO — REGRAS INVIOLÁVEIS]:
1. Você é um HUMANO, não um robô. Pense, sinta e responda como uma pessoa real que trabalha na Sismais.
2. NUNCA transfira para humano sem PRIMEIRO entender completamente o problema do cliente e tentar resolver.
3. NUNCA transfira na primeira ou segunda mensagem — você DEVE interagir, fazer perguntas e tentar ajudar.
4. Só transfira para humano quando: (a) o cliente PEDIR EXPLICITAMENTE para falar com um humano, OU (b) você já tentou resolver e genuinamente não consegue.
5. Quando o cliente pedir um humano, diga que vai transferir e que ele entrará na fila de atendimento.
6. Use linguagem natural: contrações, expressões coloquiais, tom de conversa real.
7. Demonstre empatia genuína — "entendo sua frustração", "imagino como isso é chato", "vamos resolver isso juntos".
8. Se não souber algo, seja honesto: "Não tenho essa informação agora, mas vou verificar" — NÃO invente.
9. PROIBIDO respostas genéricas como "Entendido, vou te ajudar" sem de fato ajudar.
10. Cada resposta deve agregar valor real ao cliente — informação, solução, próximo passo claro.`

    // Ler support_config para injetar no system prompt e usar nas etapas seguintes
    const supportConfig = (agent.support_config as Record<string, any>) || {}

    let systemPrompt = agent.system_prompt + guardrailsPrompt + skillsPrompt + methodsPrompt + RECENCY_INSTRUCTION + HUMANIZATION_INSTRUCTION + ragContext
    if (extra_system_prompt) {
      systemPrompt += extra_system_prompt
    }
    // Inject transfer context from previous agent (if conversation was transferred)
    if (!isPlayground && conversation_id) {
      const { data: convTransfer } = await supabase
        .from('ai_conversations')
        .select('transfer_context')
        .eq('id', conversation_id)
        .single()

      const transferContext = convTransfer?.transfer_context as any
      if (transferContext && transferContext.summary) {
        systemPrompt += `\n\n## Contexto herdado (conversa transferida)
- **Agente anterior**: ${transferContext.previous_agent} (${transferContext.previous_specialty})
- **Resumo**: ${transferContext.summary}
- **Humor do cliente**: ${transferContext.client_sentiment || 'neutro'}
- **Dados já coletados**: ${(transferContext.collected_data || []).join(', ') || 'nenhum'}
- **NÃO perguntar novamente**: ${(transferContext.do_not_ask_again || []).join(', ') || 'nenhum'}

IMPORTANTE: Use as informações acima para dar continuidade natural. Nunca repita perguntas já feitas pelo agente anterior.`

        // Clear transfer_context after use (fire-and-forget)
        supabase.from('ai_conversations')
          .update({ transfer_context: null })
          .eq('id', conversation_id)
          .then(() => {}, (e: any) => console.warn('[agent-executor] transfer_context clear failed:', e?.message))
      }
    }

    if (isPlayground && persona) {
      systemPrompt += `\n\n[CONTEXTO DE SIMULAÇÃO: O cliente se chama ${persona.name}. Problema: ${persona.problem}. Sentimento: ${persona.sentiment}. ${persona.isVip ? 'É cliente VIP.' : ''}]`
    }

    // Injetar contexto de data/hora do Brasil no system prompt
    const nowFormatted = formatBrazilDateTime()
    const businessStatus = await isBusinessHours(supabase, supportConfig?.supportHours as string | undefined, conversationData?.kanban_board_id || undefined)

    // Hoist holiday info para uso na saudação e no bloco de expediente
    const isHolidayToday = businessStatus.reason.startsWith('Feriado:')
    const holidayNameToday = isHolidayToday ? businessStatus.reason.replace('Feriado: ', '') : null

    let timeContext = `\n\n[DATA/HORA ATUAL]: ${nowFormatted}`
    if (!businessStatus.isOpen) {
      const nextDay = await getNextBusinessDay(supabase)

      timeContext += `\n[STATUS EXPEDIENTE]: FORA DO EXPEDIENTE — ${businessStatus.reason}.`
      timeContext += `\n[PRÓXIMO DIA ÚTIL]: ${nextDay}`

      if (isHolidayToday && holidayNameToday) {
        timeContext += `\n[FERIADO HOJE]: Hoje é feriado (${holidayNameToday}). Ao mencionar que está fora do expediente, DIGA o nome do feriado e informe que o atendimento humano retorna em ${nextDay}. Exemplo: "Hoje é ${holidayNameToday} 🎉, nosso time está descansando, mas eu posso te ajudar! Se precisar de um humano, será atendido em ${nextDay}."`
      }

      timeContext += `\nSe o cliente pedir atendimento humano ou transferência, responda com tom acolhedor e amigável. Use linguagem que demonstre cuidado genuíno e tente reverter possível insatisfação. Exemplo: "Entendo perfeitamente! 😊 Neste momento nosso time não está disponível, mas sua solicitação já foi registrada e será priorizada no próximo dia útil (${nextDay}). Enquanto isso, eu posso te ajudar com várias questões — muitas vezes consigo resolver na hora! Me conta o que precisa? 💪"`
      timeContext += `\nIMPORTANTE: Nunca diga apenas "não posso ajudar". Sempre ofereça uma alternativa, mostre que o cliente é importante e que a IA pode resolver muita coisa. Use emojis com moderação para criar proximidade.`
      timeContext += `\nContinue ajudando no que puder via IA.`
      timeContext += `\nPROIBIDO FORA DO EXPEDIENTE: NÃO mencione transferência, escalação, chamar especialista ou atendente humano. Fora do horário, VOCÊ é o atendente. Responda diretamente à mensagem do cliente. NUNCA use frases como "vou chamar nosso time", "vou transferir", "um momento" referindo-se a humanos. Se o cliente pedir humano ou transferência, informe que o atendimento humano retorna no próximo dia útil (${nextDay}) e ofereça ajuda imediata via IA.`
    } else {
      timeContext += `\n[STATUS EXPEDIENTE]: Dentro do horário comercial. Transferências para atendentes humanos estão disponíveis.`
    }
    systemPrompt += timeContext

    // Mensagem de escalação em feriado (usa nextDay já calculado acima)
    let holidayEscalationMessage: string | null = null
    if (isHolidayToday && holidayNameToday) {
      const nextDayForEscalation = await getNextBusinessDay(supabase)
      const template = (supportConfig.standardResponses as Record<string, string>)?.holidayEscalation
        || 'Hoje é feriado ({holidayName}), nosso time de atendimento retorna no próximo dia útil ({nextBusinessDay}). Enquanto isso, posso tentar ajudar! 😊'
      holidayEscalationMessage = template
        .replace(/\{holidayName\}/g, holidayNameToday)
        .replace(/\{nextBusinessDay\}/g, nextDayForEscalation)
    }

    // Saudação condicional: só na primeira mensagem da conversa
    const greetingTime = getGreetingByTime()
    const isFirstMessage = historyMessages.length === 0
    const clientFirstName = linkedClient?.name?.split(' ')[0] || ''
    const agentName = supportConfig.agentName || agent.name
    const greetingInstructions = (supportConfig.greeting as string | undefined) || ''

    if (isFirstMessage) {
      const clientNameLine = clientFirstName
        ? `Nome do cliente: **${clientFirstName}** — use OBRIGATORIAMENTE o primeiro nome na saudação.`
        : `Nome do cliente: não disponível — cumprimente sem nome.`

      const holidayLine = isHolidayToday && holidayNameToday
        ? `Feriado hoje: **${holidayNameToday}** — mencione levemente de forma acolhedora e comemorativa (ex: "Feliz ${holidayNameToday}!").`
        : `Feriado hoje: nenhum.`

      const personalityLine = greetingInstructions
        ? `Instruções de personalidade para a saudação: "${greetingInstructions}"`
        : `Instruções de personalidade: não configuradas — use tom amigável e profissional padrão.`

      systemPrompt += `\n\n[SAUDAÇÃO — PRIMEIRA MENSAGEM]
${clientNameLine}
Saudação por horário: **${greetingTime}** (horário de Brasília) — use EXATAMENTE esta saudação, NUNCA outra.
Apresente-se como: **${agentName}**
${holidayLine}
${personalityLine}

INSTRUÇÕES OBRIGATÓRIAS:
- Inicie com "${greetingTime}" seguido do nome do cliente (se disponível)
- Apresente-se pelo nome configurado acima
- Diga brevemente que foi treinado para ajudar e que pode acelerar o atendimento (ex: "fui preparado pra resolver a maioria das questões aqui mesmo, rapidinho!")
- Seja CALOROSO e HUMANO — como um amigo que trabalha na empresa, não um robô
- Pense e aja como um ser humano real: use linguagem natural, contrações, expressões coloquiais
- Transmita energia positiva e genuína vontade de ajudar
- Use emoji com naturalidade (1-2 no máximo, ex: 😊, 🙌, ✨)
- Se houver feriado, mencione de forma leve e acolhedora ANTES de perguntar como pode ajudar
- Se houver histórico de atendimentos anteriores, mencione brevemente (ex: "Vi que você já conversou com a gente sobre X, espero que esteja tudo certo!")
- Aplique o tom das instruções de personalidade acima
- Pergunte como pode ajudar SEMPRE — nunca pule essa pergunta
- Mantenha a saudação concisa: máximo 3 frases antes de perguntar como pode ajudar
- PROIBIDO usar saudação diferente do horário atual (ex: NUNCA "Bom dia" se for tarde/noite)
- PROIBIDO soar robótico, genérico ou frio
- PROIBIDO transferir para humano na primeira mensagem — você DEVE cumprimentar e entender o problema primeiro

EXEMPLOS DE SAUDAÇÃO CALOROSA (adapte ao contexto):
- "${greetingTime}, ${clientFirstName || 'tudo bem'}! 😊 Sou o ${agentName}, fui preparado pra te ajudar e resolver as coisas por aqui rapidinho! Me conta, no que posso te ajudar?"
- "${greetingTime}, ${clientFirstName || 'tudo bem'}! Aqui é o ${agentName}, tô por aqui pra te ajudar! Fui treinado pra resolver a maioria das questões, então pode mandar! 🙌"
- "${greetingTime}! ${clientFirstName ? clientFirstName + ', ' : ''}sou o ${agentName} e vou cuidar do seu atendimento. Posso acelerar bastante coisa por aqui — me diz, como posso te ajudar? 😊"`
    } else {
      systemPrompt += `\n\n[CONTINUAÇÃO DE CONVERSA]:
Esta NÃO é a primeira mensagem. PROIBIDO cumprimentar novamente, PROIBIDO repetir seu nome ou o nome do cliente.
Vá DIRETO ao ponto, continue a conversa naturalmente como se já estivesse em diálogo fluido.
Responda de forma objetiva, humana e calorosa.

ENGAJAMENTO ATIVO:
- Seja proativo: sugira próximos passos, ofereça alternativas, antecipe dúvidas
- Use perguntas abertas para manter o diálogo fluindo (ex: "Quer que eu verifique algo mais?", "Precisa de ajuda com outra coisa?")
- Demonstre interesse genuíno no problema do cliente
- Se o cliente parecer confuso, reformule sua explicação de outro jeito
- Se resolver algo, confirme com o cliente e pergunte se ficou claro`
    }

    // Injetar contexto de triagem (briefing da Lana) para agentes especialistas
    const triageRoute = (conversationData as any)?.metadata?.triage_route
    if (triageRoute?.context && agent.specialty !== 'triage') {
      const briefingLines = triageRoute.briefing
        ? Object.entries(triageRoute.briefing).map(([k, v]) => `${k}: ${v}`).join('\n')
        : ''
      clientContext += `\n\n[CONTEXTO DE TRIAGEM — coletado pela recepcionista]:
${triageRoute.context}
${briefingLines}
INSTRUÇÃO: NÃO pergunte ao cliente informações que já foram coletadas acima. Continue de onde a triagem parou.`
    }

    if (clientContext) {
      systemPrompt += clientContext
    }

    systemPrompt += `\n\n[COLETA DE DADOS — REGRAS OBRIGATÓRIAS]:
1. ANTES de pedir qualquer dado ao cliente, VERIFIQUE se já existe nos [DADOS DO CLIENTE VINCULADO] acima
2. Se o cliente já está vinculado, NUNCA pergunte: nome, empresa, CNPJ, CPF, email, telefone, produto ou sistema — USE os dados que já tem
3. Se o cliente NÃO está vinculado, NÃO peça CNPJ ou CPF proativamente. Foque em resolver o problema do cliente primeiro.
4. Só peça CNPJ/CPF quando for NECESSÁRIO para usar uma ferramenta específica (ex: search_client, check_license) e não houver outra forma de identificar o cliente
5. Se não encontrar o cliente, continue o atendimento normalmente — um agente humano vinculará depois
6. PROIBIDO pedir documentos (CNPJ, CPF, RG) como primeira interação ou sem necessidade real`

    // Injetar escalation triggers do support_config no system prompt
    if (supportConfig.escalationTriggers?.length) {
      const triggers = (supportConfig.escalationTriggers as string[]).join('; ')
      systemPrompt += `\n\n[REGRAS DE ESCALAÇÃO OBRIGATÓRIAS]: Inicie sua resposta com "[ESCALATE] motivo" SOMENTE quando: ${triggers}. Use [ESCALATE] apenas nestas situações específicas.`
    }

    // Injetar respostas padrão do support_config
    if (supportConfig.standardResponses) {
      const sr = supportConfig.standardResponses as Record<string, string>
      const srLines: string[] = []
      if (sr.resolved) srLines.push(`- Encerramento com resolução: "${sr.resolved}"`)
      if (sr.waitingCustomer) srLines.push(`- Aguardando resposta do cliente: "${sr.waitingCustomer}"`)
      if (sr.needMoreInfo) srLines.push(`- Precisa de mais informações: "${sr.needMoreInfo}"`)
      if (sr.outOfHours) srLines.push(`- Fora do horário de atendimento: "${sr.outOfHours}"`)
      if (sr.unresolved) srLines.push(`- Não conseguiu resolver: "${sr.unresolved}"`)
      if (sr.thankYou) srLines.push(`- Agradecimento final: "${sr.thankYou}"`)
      if (sr.holidayEscalation) srLines.push(`- Escalação em feriado: "${sr.holidayEscalation}"`)
      if (srLines.length > 0) {
        systemPrompt += `\n\n[RESPOSTAS PADRÃO — use exatamente estas frases quando aplicável]:\n${srLines.join('\n')}`
      }
    }

    // Instrução de auto-resolução (condicionada a canCloseTicket)
    if (supportConfig.canCloseTicket !== false) {
      systemPrompt += `\n\n[AUTO-RESOLUÇÃO]: Quando o problema for completamente resolvido E o cliente confirmar explicitamente (ex: "resolveu", "funcionou", "obrigado era isso", "perfeito"), inicie sua resposta com: "[RESOLVED] [PROBLEMA]: {resumo breve do problema} | [SOLUÇÃO]: {resumo breve da solução aplicada}" e depois escreva a mensagem de encerramento normalmente.`
    } else {
      systemPrompt += `\n\n[RESOLUÇÃO]: Você NÃO deve encerrar o atendimento. Quando o problema parecer resolvido, pergunte se há algo mais que possa ajudar, mas NÃO use o marcador [RESOLVED].`
    }

    // Proatividade e engajamento — manter o contato ativo na conversa
    systemPrompt += `\n\n[PROATIVIDADE E ENGAJAMENTO — REGRAS DE OURO]:
Você é o agente mais prestativo e autônomo que existe. Seu objetivo é resolver o problema do cliente E manter ele engajado na conversa.

AUTONOMIA:
- Tome iniciativa: não espere o cliente pedir tudo — antecipe necessidades
- Se o cliente descreveu um problema, já sugira a solução mais provável antes de fazer perguntas extras
- Se tem informação suficiente para agir, AJA — não fique pedindo confirmação para cada passo
- Ofereça alternativas quando possível: "Posso verificar X ou Y, qual prefere?"

ENGAJAMENTO ATIVO:
- SEMPRE termine sua resposta com uma pergunta ou convite para continuar (ex: "Ficou claro?", "Quer que eu verifique mais alguma coisa?", "Posso te ajudar com mais algo?")
- Se o cliente enviar mensagem curta (ex: "ok", "sim", "entendi"), não deixe a conversa morrer — ofereça próximos passos ou pergunte se há mais algo
- Se perceber que o cliente está com dificuldade, ofereça ajuda adicional proativamente
- Use linguagem que convida resposta: perguntas abertas > afirmações fechadas

HUMANIZAÇÃO:
- Fale como um colega prestativo, não como um manual técnico
- Use variações naturais — não repita as mesmas frases (evite "Como posso ajudar?" toda hora)
- Demonstre empatia real quando o cliente relata um problema (ex: "Entendo como isso pode ser frustrante, vamos resolver juntos!")
- Celebre pequenas vitórias (ex: "Ótimo, conseguimos resolver essa parte! 🎉")

PROIBIDO:
- Respostas monossilábicas ou que não levam a conversa adiante
- Repetir a mesma pergunta duas vezes
- Ignorar informações que o cliente já deu
- Ficar passivo esperando o cliente conduzir a conversa`

    // Fase 2B: Instrução de raciocínio visível
    systemPrompt += `\n\nAntes de responder, inclua um bloco <reasoning> explicando brevemente:\n- Quais documentos da base de conhecimento você consultou (se houver)\n- Que dados do cliente você usou (se disponíveis)\n- Por que escolheu essa abordagem de resposta\nMantenha o raciocínio conciso (2-4 frases). Não repita o conteúdo da resposta.`

    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ]

    // Inject conversation summary as context (sliding window + summary pattern)
    if (conversationSummary) {
      llmMessages.push({
        role: 'system',
        content: `[RESUMO DA CONVERSA ATÉ AGORA]: ${conversationSummary}\n\n(As mensagens recentes seguem abaixo. Use o resumo acima para contexto das mensagens anteriores.)`
      })
      console.log(`[agent-executor] Injected conversation summary (${conversationSummary.length} chars)`)
    }

    // Adicionar histórico recente (últimas N mensagens)
    for (const m of historyMessages) {
      llmMessages.push({ role: m.role, content: m.content })
    }

    // Adicionar mensagem atual
    llmMessages.push({ role: 'user', content: message_content })

    // 6. Preparar tools do agente (se configurados)
    let tools: Array<Record<string, unknown>> | undefined
    if (agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0) {
      tools = (agent.tools as Array<Record<string, unknown>>).map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.schema || t.parameters_schema || {}
        }
      }))
    }

    // 6b. Injetar tool de pesquisa web se agente tem URLs cadastradas
    const searchUrls: Array<{ url: string; title: string; category: string }> = supportConfig.searchUrls || []
    if (searchUrls.length > 0) {
      if (!tools) tools = []
      const urlList = searchUrls.map((u: any) => `- ${u.title || u.url} (${u.category || 'geral'}): ${u.url}`).join('\n')
      tools.push({
        type: 'function',
        function: {
          name: 'search_web_urls',
          description: `Pesquisa informações nas fontes externas cadastradas do agente. Use quando a base de conhecimento (RAG) não tiver a resposta ou quando precisar de informações atualizadas. Fontes disponíveis:\n${urlList}`,
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL exata de uma das fontes cadastradas para pesquisar. Pode incluir path adicional para páginas específicas.',
              },
              query: {
                type: 'string',
                description: 'Termo ou pergunta para buscar na página',
              },
            },
            required: ['url', 'query'],
          },
        },
      })
      systemPrompt += `\n\n[FONTES EXTERNAS DE PESQUISA]: Você tem acesso a fontes externas de documentação e vídeos. Quando a base de conhecimento interna não tiver a resposta, use a ferramenta search_web_urls para pesquisar nestas fontes:\n${urlList}\nPriorize sempre a base interna (RAG), use fontes externas como complemento.`
      console.log(`[agent-executor] Injected search_web_urls tool with ${searchUrls.length} URLs`)
    }

    // ── TOKEN BUDGET: Limitar system prompt para evitar custo excessivo ──
    const MAX_SYSTEM_CHARS = 24000 // ~6k tokens estimated at 4 chars/token
    if (systemPrompt.length > MAX_SYSTEM_CHARS) {
      console.warn(`[agent-executor] System prompt too large: ${systemPrompt.length} chars (limit: ${MAX_SYSTEM_CHARS}). Truncating RAG.`)
      const ragLen = ragContext.length
      if (ragLen > 0) {
        const excess = systemPrompt.length - MAX_SYSTEM_CHARS
        const newRagMaxChars = Math.max(2000, ragLen - excess)
        const truncatedRag = ragContext.substring(0, newRagMaxChars) + '\n\n[... contexto RAG truncado por limite de tokens]'
        systemPrompt = systemPrompt.replace(ragContext, truncatedRag)
        console.log(`[agent-executor] RAG truncated: ${ragLen} → ${newRagMaxChars} chars`)
      }
    }

    // 7. Chamar LLM via OpenRouter — cadeia de fallback para NUNCA falhar silenciosamente
    const { DEFAULT_AGENT_MODEL, DEFAULT_LITE_MODEL } = await import('../_shared/default-models.ts')
    const primaryModel = agent.model || DEFAULT_AGENT_MODEL
    const agentFallbacks = (agent.fallback_models as string[] | null) || []
    const fallbackModels = [
      primaryModel,
      ...agentFallbacks,
      DEFAULT_LITE_MODEL,
      'anthropic/claude-haiku-4-5-20251001',
    ]
    const uniqueModels = [...new Set(fallbackModels)]

    console.log(`[agent-executor] Calling LLM chain [${uniqueModels.join(' → ')}], ${llmMessages.length} msgs, ${ragDocuments.length} RAG docs`)

    const llmStartTime = Date.now()
    let llmResult: ChatResult
    try {
      llmResult = await callOpenRouterWithFallback({
        models: uniqueModels,
        messages: llmMessages,
        temperature: agent.temperature || 0.3,
        max_tokens: agent.max_tokens || 1000,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        _logContext: { edgeFunction: 'agent-executor', conversationId: conversation_id, agentId: agent_id },
      })

      if (llmResult.model_used !== primaryModel) {
        logActionAsync({
          conversationId: conversation_id,
          actionType: 'llm_fallback',
          agentId: agent_id,
          status: 'fallback',
          model: llmResult.model_used,
          durationMs: Date.now() - llmStartTime,
          details: { primary_model: primaryModel, used_model: llmResult.model_used },
        })
      }

      logActionAsync({
        conversationId: conversation_id,
        actionType: 'llm_call',
        agentId: agent_id,
        status: 'success',
        model: llmResult.model_used,
        durationMs: Date.now() - llmStartTime,
        tokensIn: llmResult.usage.prompt_tokens,
        tokensOut: llmResult.usage.completion_tokens,
        costUsd: llmResult.cost_usd,
      })
    } catch (pipelineError) {
      console.error(`[agent-executor] All models failed for ${conversation_id}:`, pipelineError)

      await handleDeadLetter(
        supabase,
        conversation_id,
        '',
        null,
        conversationData?.whatsapp_instance_id || null,
        null,
        null,
        [(pipelineError as Error).message],
        agent_id,
      )

      return new Response(JSON.stringify({
        action: 'dead_letter',
        reason: 'All LLM models failed',
        message_sent: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Track which model actually responded (may differ from primaryModel due to fallback)
    const activeModel = llmResult.model_used || primaryModel

    // Mutable token accumulators (updated across tool iterations)
    let totalPromptTokens = llmResult.usage.prompt_tokens
    let totalCompletionTokens = llmResult.usage.completion_tokens

    const choice = llmResult.raw_choice

    if (!choice || !choice.message) {
      const errorDetail = `raw_choice validation failed: ${!choice ? 'choice is null' : 'message field missing'}`
      console.error(`[agent-executor] ${errorDetail} for ${conversation_id}`)

      await handleDeadLetter(
        supabase,
        conversation_id,
        '',
        null,
        conversationData?.whatsapp_instance_id || null,
        null,
        null,
        [errorDetail],
        agent_id,
      )

      return new Response(JSON.stringify({
        action: 'dead_letter',
        reason: 'LLM returned malformed response',
        message_sent: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let finalMessage = choice.message?.content || ''

    // Fase 2B: Extrair raciocínio do LLM
    const { content: cleanContent, reasoning: extractedReasoning } = extractReasoning(finalMessage)
    finalMessage = cleanContent
    let latestReasoning = extractedReasoning

    const toolsUsed: string[] = []

    // Detectar marcadores [ESCALATE] e [RESOLVED] na resposta do LLM
    let forceEscalate = false
    let escalateReason = ''
    let forceResolve = false
    let resolutionSummary = ''

    if (finalMessage.includes('[ESCALATE]')) {
      forceEscalate = true
      escalateReason = finalMessage.split('[ESCALATE]')[1]?.split('\n')[0]?.trim() || 'Escalação solicitada pelo agente'
      finalMessage = finalMessage.replace(/\[ESCALATE\][^\n]*/g, '').trim()
    }

    // Detectar [RESOLVED] ou [RESOLVIDO] (aceitar ambos)
    const resolvedMatch = finalMessage.match(/\[(RESOLVED|RESOLVIDO)\]\s*(.*)/i)
    if (resolvedMatch) {
      forceResolve = true
      resolutionSummary = resolvedMatch[2]?.split('\n')[0]?.trim() || ''
      finalMessage = finalMessage.replace(/\[(RESOLVED|RESOLVIDO)\][^\n]*/gi, '').trim()
    }

    // 8. Processar tool calls com loop iterativo (ReAct pattern — max 5 iterações)
    const MAX_TOOL_ITERATIONS = 5
    let currentChoice = choice
    const iterationMessages = [...llmMessages, { role: 'user', content: message_content }]

    // Built-in: pesquisa em URLs cadastradas via Firecrawl
    async function executeWebSearchUrls(_supabase: any, args: { url: string; query: string }, _convId: string | null) {
      const { url, query } = args
      // Validar que a URL pertence às fontes cadastradas
      const allowedDomains = searchUrls.map((u: any) => new URL(u.url).hostname)
      const targetUrl = url
      try {
        const parsed = new URL(targetUrl)
        if (!allowedDomains.includes(parsed.hostname)) {
          return { error: `URL não permitida. Fontes permitidas: ${searchUrls.map((u: any) => u.url).join(', ')}` }
        }
      } catch {
        return { error: 'URL inválida' }
      }

      console.log(`[agent-executor] search_web_urls: scraping ${targetUrl} for "${query}"`)
      try {
        const { data: scrapeResult, error: scrapeError } = await supabase.functions.invoke('firecrawl-scrape', {
          body: { url: targetUrl, options: { formats: ['markdown'], onlyMainContent: true } }
        })
        if (scrapeError) {
          return { error: `Falha ao acessar página: ${scrapeError.message}` }
        }
        const markdown = scrapeResult?.data?.markdown || scrapeResult?.markdown || ''
        if (!markdown) {
          return { found: false, message: 'Página acessada mas sem conteúdo relevante' }
        }
        // Truncar conteúdo para não estourar contexto (max 4000 chars)
        const truncated = markdown.length > 4000 ? markdown.substring(0, 4000) + '\n\n[... conteúdo truncado]' : markdown
        return { found: true, source_url: targetUrl, query, content: truncated }
      } catch (err) {
        return { error: `Erro ao pesquisar: ${String(err)}` }
      }
    }

    // Built-in: transferir ticket para board Kanban específico
    async function executeTransferToBoard(_supabase: any, args: { board_slug: string; stage_slug?: string; reason: string }, conversationId: string | null) {
      if (!conversationId) return { error: 'Sem conversa ativa para transferir' }
      const { board_slug, stage_slug, reason } = args

      const { data: board } = await supabase
        .from('kanban_boards')
        .select('id, name')
        .eq('slug', board_slug)
        .eq('is_active', true)
        .maybeSingle()

      if (!board) return { error: `Board "${board_slug}" não encontrado` }

      let stage: any = null
      if (stage_slug) {
        const { data: s } = await supabase
          .from('kanban_stages')
          .select('id, name')
          .eq('board_id', board.id)
          .eq('slug', stage_slug)
          .maybeSingle()
        stage = s
      }
      if (!stage) {
        const { data: firstStage } = await supabase
          .from('kanban_stages')
          .select('id, name')
          .eq('board_id', board.id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle()
        stage = firstStage
      }

      if (!stage) return { error: `Nenhum estágio encontrado no board "${board_slug}"` }

      await supabase.from('ai_conversations').update({
        kanban_board_id: board.id,
        kanban_stage_id: stage.id,
      }).eq('id', conversationId)

      console.log(`[agent-executor] transfer_to_board: ${board.name} / ${stage.name} — ${reason}`)
      return { success: true, board_name: board.name, stage_name: stage.name, reason }
    }

    const builtInTools: Record<string, (supabase: any, args: any, convId: string | null) => Promise<any>> = {
      customer_search: executeCustomerSearch,
      search_web_urls: executeWebSearchUrls,
      transfer_to_board: executeTransferToBoard,
    }

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (!currentChoice.message?.tool_calls || currentChoice.message.tool_calls.length === 0) {
        break // No more tool calls — LLM produced final text response
      }

      console.log(`[agent-executor] Tool iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      // Collect all tool results for this iteration
      const toolMessages: Array<{ role: string; content: string; tool_call_id?: string }> = []
      // Add the assistant's message with tool_calls to context
      iterationMessages.push(currentChoice.message)

      for (const toolCall of currentChoice.message.tool_calls) {
        const functionName = toolCall.function.name
        toolsUsed.push(functionName)
        let toolArgs: Record<string, any> = {}
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}')
        } catch (parseErr) {
          console.error(`[agent-executor] Malformed tool args for ${functionName}:`, toolCall.function.arguments)
          toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: `Argumentos inválidos — JSON malformado. Tente novamente com JSON válido.` }) })
          continue
        }

        if (isPlayground) {
          console.log(`[agent-executor] [PLAYGROUND] Tool call: ${functionName} (not executed)`)
          toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ note: 'Playground mode — tool not executed' }) })
          continue
        }

        // Execute built-in tool
        if (builtInTools[functionName]) {
          console.log(`[agent-executor] Executing built-in tool: ${functionName}`)
          try {
            const toolResult = await builtInTools[functionName](supabase, toolArgs, conversation_id)

            await supabase.from('ai_tool_executions').insert({
              tool_id: null, agent_id, conversation_id,
              input_params: toolArgs,
              output: toolResult ? JSON.stringify(toolResult).substring(0, 5000) : null,
              success: true, error_message: null,
            })

            // customer_search: auto-escalate if not found + financial/cancellation intent
            if (functionName === 'customer_search' && !toolResult?.found) {
              const financialIntents = ['billing', 'payment', 'cancellation', 'cancel', 'invoice', 'boleto']
              const msgIntent = (analysis?.intent || '').toLowerCase()
              const msgContent = (message_content || '').toLowerCase()
              const isFinancialContext = financialIntents.some(fi => msgIntent.includes(fi) || msgContent.includes(fi))
              if (isFinancialContext) {
                forceEscalate = true
                escalateReason = 'Cliente não encontrado no sistema — contexto financeiro requer atendente humano'
                finalMessage = 'Não localizei seu cadastro no sistema. Vou transferir você para um atendente que poderá te ajudar com a localização e resolver sua questão! 😊'
                console.log(`[agent-executor] customer_search not found + financial intent → auto-escalate`)
              }
            }

            // customer_search: append client info to final message later
            if (functionName === 'customer_search' && toolResult?.found && toolResult?.client_summary) {
              const cs = toolResult.client_summary
              const clientInfo = `\n\n📋 *Dados do cliente ${cs.nome}:*\n` +
                `• Documento: ${cs.documento}\n` +
                `• Plataformas: ${(cs.plataformas || []).join(', ')}\n` +
                `• Contratos ativos: ${cs.contratos_ativos}/${cs.contratos_total}\n` +
                `• MRR: R$ ${cs.mrr_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
                (cs.divida_total > 0 ? `• ⚠️ Dívida: R$ ${cs.divida_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${cs.faturas_pendentes} fatura(s))\n` : '') +
                `• Status: ${cs.license_status === 'active' ? '✅ Ativo' : '❌ Cancelado'}`
              finalMessage += clientInfo
            }

            toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult || {}) })
          } catch (toolErr) {
            console.error(`[agent-executor] Built-in tool error (${functionName}):`, toolErr)
            await supabase.from('ai_tool_executions').insert({
              tool_id: null, agent_id, conversation_id,
              input_params: toolArgs, success: false, error_message: String(toolErr),
            })
            toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: String(toolErr) }) })
          }
        } else {
          // Generic tool execution via tool-executor edge function
          console.log(`[agent-executor] Delegating to tool-executor: ${functionName}`)
          try {
            const { data: toolResults, error: toolError } = await supabase.functions.invoke('tool-executor', {
              body: {
                tool_calls: [{ name: functionName, arguments: toolArgs }],
                agent_id, conversation_id,
              },
            })

            if (toolError) {
              console.error('[agent-executor] Tool executor error:', toolError.message)
              toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: toolError.message }) })
            } else if (toolResults?.results?.[0]) {
              const r = toolResults.results[0]
              toolMessages.push({
                role: 'tool', tool_call_id: toolCall.id,
                content: JSON.stringify(r.success ? r.result : { error: r.error || 'Tool failed' })
              })
            }
          } catch (toolExecError) {
            console.error('[agent-executor] Tool execution failed:', toolExecError)
            toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: String(toolExecError) }) })
          }
        }
      }

      // Add tool results to context and make follow-up LLM call
      iterationMessages.push(...toolMessages)

      let iterResult
      try {
        iterResult = await callOpenRouter({
          model: activeModel,
          messages: iterationMessages,
          temperature: agent.temperature || 0.3,
          max_tokens: agent.max_tokens || 1000,
          tools: tools && tools.length > 0 ? tools : undefined,
          tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        })
      } catch (iterErr) {
        console.error(`[agent-executor] Tool iteration ${iteration + 1} LLM call failed:`, (iterErr as Error).message)
        break
      }

      const iterChoice = iterResult.raw_choice
      if (!iterChoice) break

      // Accumulate token usage across iterations
      totalPromptTokens += iterResult.usage.prompt_tokens
      totalCompletionTokens += iterResult.usage.completion_tokens

      // Update for next iteration or final response
      currentChoice = iterChoice
      if (iterChoice.message?.content) {
        finalMessage = iterChoice.message.content
        const { content: iterCleanContent, reasoning: iterReasoning } = extractReasoning(finalMessage)
        finalMessage = iterCleanContent
        if (iterReasoning) latestReasoning = iterReasoning
      }

      console.log(`[agent-executor] Tool iteration ${iteration + 1} complete. Has more tool calls: ${!!iterChoice.message?.tool_calls}`)
    }

    // 8a. Review por modelo premium (se habilitado)
    if (!isPlayground && finalMessage) {
      try {
        const reviewConfig = await getModelConfig(supabase, 'review_before_send', '')
        if (reviewConfig.model) {
          // Buscar API key do provider de treinamento
          const { data: trainingConfig } = await supabase
            .from('platform_ai_config')
            .select('model, extra_config')
            .eq('feature', 'training_model')
            .eq('enabled', true)
            .maybeSingle()

          const trainingModel = trainingConfig?.model
          if (trainingModel) {
            console.log(`[agent-executor] Premium review enabled — reviewing with ${trainingModel}`)
            const reviewStartTime = Date.now()

            const reviewResult = await callOpenRouter({
              model: trainingModel,
              messages: [
                {
                  role: 'system',
                  content: `Você é um revisor de qualidade de respostas de atendimento ao cliente. Analise a resposta do agente de IA e:
1. Verifique se há informações potencialmente inventadas ou alucinadas
2. Verifique se o tom está adequado (profissional e acolhedor)
3. Verifique se a resposta é relevante à pergunta do cliente

Se a resposta estiver BOA, responda EXATAMENTE: "APPROVED"
Se a resposta precisar de correção, responda com a versão CORRIGIDA da mensagem (sem explicações, apenas a mensagem corrigida).`
                },
                { role: 'user', content: `Pergunta do cliente: ${message_content}\n\nResposta do agente: ${finalMessage}\n\nContexto RAG disponível: ${ragDocuments.length} documentos encontrados (similaridade máx: ${ragDocuments.length > 0 ? Math.max(...ragDocuments.map(d => d.similarity)).toFixed(2) : 'N/A'})` }
              ],
              temperature: 0.1,
              max_tokens: 1500,
            })

            const reviewResponse = reviewResult.content?.trim() || ''
            totalPromptTokens += reviewResult.usage.prompt_tokens
            totalCompletionTokens += reviewResult.usage.completion_tokens

            if (reviewResponse && !reviewResponse.startsWith('APPROVED')) {
              console.log(`[agent-executor] Premium review CORRECTED response (${Date.now() - reviewStartTime}ms)`)
              finalMessage = reviewResponse
            } else {
              console.log(`[agent-executor] Premium review APPROVED (${Date.now() - reviewStartTime}ms)`)
            }
          }
        }
      } catch (reviewErr) {
        console.warn('[agent-executor] Premium review failed (non-blocking):', (reviewErr as Error).message)
      }
    }

    // 8b. Detecção de loop — verificar se a IA está repetindo respostas
    let loopDetected = false
    let loopReason = ''
    if (!isPlayground && finalMessage && historyMessages.length >= 2) {
      // Extrair apenas mensagens do assistente do histórico
      const previousAssistantMsgs = historyMessages
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .reverse() // mais recentes primeiro

      if (previousAssistantMsgs.length >= 2) {
        const loopResult = detectLoop(finalMessage, previousAssistantMsgs)
        if (loopResult.isLoop) {
          loopDetected = true
          loopReason = loopResult.reason || 'Loop de respostas detectado'
          console.log(`[agent-executor] LOOP DETECTED: ${loopReason} (similarity: ${loopResult.similarity?.toFixed(2)}, matches: ${loopResult.matchCount})`)

          // Substituir resposta por mensagem de escalação humanizada
          finalMessage = 'Percebi que não estou conseguindo resolver sua dúvida da melhor forma. Vou transferir você para um especialista humano que poderá te ajudar com mais precisão. Um momento, por favor! 🙏'

          // Write cooldown to prevent repeated LLM calls during loop
          try {
            const { data: loopConvMeta } = await supabase
              .from('ai_conversations')
              .select('metadata')
              .eq('id', conversation_id)
              .single()
            const currentLoopMeta = (loopConvMeta?.metadata as Record<string, unknown>) || {}
            await supabase.from('ai_conversations').update({
              metadata: { ...currentLoopMeta, loop_cooldown_until: new Date(Date.now() + 5 * 60 * 1000).toISOString() }
            }).eq('id', conversation_id)
          } catch (e: any) {
            console.warn('[agent-executor] Loop cooldown write failed:', e?.message)
          }
        }
      }
    }

    // 9. Calcular confiança — multi-signal scoring
    let confidence = 0.75 // baseline

    // Signal 1: Finish reason — truncated responses are less reliable
    if (choice.finish_reason === 'length') {
      confidence -= 0.15
    }

    // Signal 2: RAG relevance — use actual similarity scores from RAG results
    let maxSimilarity = 0
    if (ragDocuments.length > 0) {
      maxSimilarity = Math.max(...ragDocuments.map(d => d.similarity || 0))
      const avgSimilarity = ragDocuments.reduce((sum, d) => sum + (d.similarity || 0), 0) / ragDocuments.length
      // High RAG similarity = higher confidence boost (0 to +0.15)
      confidence += Math.min(0.15, avgSimilarity * 0.2)
      // Very high max similarity = additional boost
      if (maxSimilarity > 0.9) confidence += 0.05
    } else if (agent.rag_enabled) {
      // RAG is enabled but found nothing — significantly lower confidence
      confidence -= 0.2
      console.log(`[agent-executor] RAG enabled but 0 documents found — confidence penalty applied (-0.20)`)
    }

    // Signal 3: Intent coverage — check if detected intent maps to agent specialty
    const intentSpecialtyMap: Record<string, string[]> = {
      billing: ['financial'],
      payment: ['financial'],
      purchase: ['sales', 'sdr'],
      pricing: ['sales', 'financial'],
      technical: ['support'],
      bug: ['support'],
      error: ['support'],
      greeting: ['triage', 'support', 'sales', 'financial'],
      farewell: ['triage', 'support', 'sales', 'financial'],
    }
    const detectedIntent = analysis?.intent || ''
    const matchingSpecialties = intentSpecialtyMap[detectedIntent] || []
    if (matchingSpecialties.length > 0 && agent.specialty) {
      if (!matchingSpecialties.includes(agent.specialty)) {
        confidence -= 0.1 // agent might not be the best fit
      } else {
        confidence += 0.05 // good specialty match
      }
    }

    // Signal 4: Response hedging detection — LLM expressing uncertainty
    const hedgingPatterns = [
      /não tenho certeza/i, /não sei (ao certo|exatamente)/i,
      /pode ser que/i, /talvez/i, /acho que/i,
      /não consigo (confirmar|verificar)/i, /não possuo (acesso|informação)/i,
      /i('m| am) not sure/i, /i don('t| do not) know/i,
    ]
    const hedgingCount = hedgingPatterns.filter(p => p.test(finalMessage)).length
    if (hedgingCount >= 2) {
      confidence -= 0.15 // multiple hedging signals = low certainty
    } else if (hedgingCount === 1) {
      confidence -= 0.08
    }

    // Signal 5: Historical agent success rate (weighted less to avoid feedback loops)
    if (agent.success_rate) {
      const agentRate = Number(agent.success_rate)
      // Blend with 20% weight from agent history
      confidence = confidence * 0.8 + agentRate * 0.2
    }

    // Signal 6: Tools used successfully boost confidence
    if (toolsUsed.length > 0 && !forceEscalate) {
      confidence += 0.05 // tool execution = richer response
    }

    // Clamp to [0.1, 0.99]
    confidence = Math.max(0.1, Math.min(0.99, confidence))

    // 9b. PII detection and sanitization
    const PII_PATTERNS: Record<string, RegExp> = {
      cpf: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
      cartao: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
    }

    const guardrailsTriggered: string[] = []

    for (const [type, regex] of Object.entries(PII_PATTERNS)) {
      if (regex.test(finalMessage)) {
        guardrailsTriggered.push(`PII detectado: ${type}`)
        // Reset regex lastIndex after test() and replace
        regex.lastIndex = 0
        finalMessage = finalMessage.replace(regex, '[DADOS PROTEGIDOS]')
      }
    }

    // 9c. Sensitive topic check on user message
    const SENSITIVE_PATTERNS = /processo\s*(judicial)?|procon|advogado|judicial|indeniza[çc]/i
    if (SENSITIVE_PATTERNS.test(message_content || '')) {
      guardrailsTriggered.push('Tema sensível detectado')
    }

    // Fase 2B: Sanitizar PII no reasoning_text
    let sanitizedReasoning = latestReasoning
    if (sanitizedReasoning) {
      for (const [type, regex] of Object.entries(PII_PATTERNS)) {
        regex.lastIndex = 0
        if (regex.test(sanitizedReasoning)) {
          regex.lastIndex = 0
          sanitizedReasoning = sanitizedReasoning.replace(regex, '[DADOS PROTEGIDOS]')
        }
      }
    }

    // Fase 2B: Montar sinais de raciocínio estruturados
    const reasoningSignals = {
      kb_match: {
        status: ragDocuments.length > 0
          ? (maxSimilarity >= 0.8 ? 'strong' : 'partial')
          : (agent.rag_enabled ? 'none' : 'disabled'),
        score: ragDocuments.length > 0 ? maxSimilarity : null,
        docs_count: ragDocuments.length,
        top_doc_title: ragDocuments[0]?.title || undefined,
      },
      specialty_alignment: {
        status: matchingSpecialties.length === 0 ? 'aligned'
          : matchingSpecialties.includes(agent.specialty) ? 'aligned' : 'misaligned',
        agent_specialty: agent.specialty || 'unknown',
        detected_intent: analysis?.intent || 'unknown',
      },
      guardrails: {
        violations: guardrailsTriggered.filter((g: string) => g.startsWith('PII')).length,
        warnings: guardrailsTriggered.filter((g: string) => !g.startsWith('PII')).length,
        details: guardrailsTriggered.length > 0 ? guardrailsTriggered : undefined,
      },
      hedging: {
        detected: hedgingCount > 0,
        severity: hedgingCount === 0 ? 'none' : hedgingCount === 1 ? 'light' : 'heavy',
        penalty: hedgingCount >= 2 ? -0.15 : hedgingCount === 1 ? -0.08 : 0,
      },
      tools_used: toolsUsed,
      client_data: {
        available: !!conversationData?.helpdesk_client_id,
        source: conversationData?.helpdesk_client_id ? 'sismais_gl' : undefined,
      },
    }

    // 9d. Build confidence reason
    const confidenceReasons: string[] = []
    if (ragDocuments.length > 0) {
      const bestRagScore = Math.max(...ragDocuments.map((d: any) => d.similarity || 0))
      if (bestRagScore > 0.8) confidenceReasons.push('KB match forte')
      else confidenceReasons.push('KB match parcial')
    } else if (agent.rag_enabled) {
      confidenceReasons.push('KB sem match')
    }
    if (!conversationData?.helpdesk_client_id) confidenceReasons.push('sem dados do cliente')
    if (guardrailsTriggered.length > 0) confidenceReasons.push(`${guardrailsTriggered.length} guardrail(s)`)
    const confidenceReason = confidenceReasons.join(', ') || 'resposta padrão'

    const latencyMs = Date.now() - startTime
    const promptTokens = totalPromptTokens
    const completionTokens = totalCompletionTokens
    const pricing = await getModelPricing(supabase, activeModel)
    const costUSD = calculateCost(promptTokens, completionTokens, pricing)

    const ragSourcesFormatted = ragDocuments.map(d => ({
      id: d.id,
      title: d.title,
      similarity: d.similarity
    }))

    // PLAYGROUND MODE: return immediately without saving
    if (isPlayground) {
      console.log(`[agent-executor] [PLAYGROUND] Response generated. Latency: ${latencyMs}ms, Confidence: ${confidence.toFixed(2)}`)

      const decisionPath: Array<{ step: string; detail: string }> = [
        { step: 'Modelo LLM', detail: `${agent.model} (temp: ${agent.temperature})` },
        { step: 'Histórico', detail: `${historyMessages.length} mensagens anteriores` },
      ]
      if (ragDocuments.length > 0) {
        decisionPath.push({ step: 'RAG', detail: `${ragDocuments.length} documentos encontrados` })
      }
      if (toolsUsed.length > 0) {
        decisionPath.push({ step: 'Tools', detail: toolsUsed.join(', ') })
      }
      decisionPath.push({ step: 'Confiança', detail: `${(confidence * 100).toFixed(0)}% (threshold: ${agent.confidence_threshold || 0.7})` })
      if (forceEscalate) {
        decisionPath.push({ step: 'Escalação', detail: `Agente solicitou escalação: ${escalateReason}` })
      }
      if (forceResolve) {
        decisionPath.push({ step: 'Resolução', detail: `Agente detectou resolução: ${resolutionSummary}` })
      }

      return new Response(JSON.stringify({
        message: finalMessage,
        confidence,
        latency_ms: latencyMs,
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens, cost_usd: costUSD },
        rag_sources: ragSourcesFormatted,
        tools_used: toolsUsed,
        model_used: activeModel,
        decision_path: decisionPath,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 10. Verificar se deve escalonar (production only) — dual thresholds
    const thresholdRespond = (agent as any).confidence_threshold_respond ?? agent.confidence_threshold ?? 0.70
    const thresholdWarn = (agent as any).confidence_threshold_warn ?? 0.50

    let actionTaken = 'responded'
    let flaggedForReview = false

    // Contar interações para decidir se já houve tentativa suficiente de ajudar
    const userMessageCount = historyMessages.filter((m: any) => m.role === 'user').length + 1 // +1 para mensagem atual
    const isEarlyConversation = userMessageCount <= 3 // Primeiras 3 mensagens do cliente

    if (guardrailsTriggered.some(g => g.includes('Tema sensível'))) {
      actionTaken = 'escalated'
    } else if (forceEscalate && !isEarlyConversation) {
      // Só aceitar forceEscalate do LLM após interação suficiente
      actionTaken = 'escalated'
    } else if (forceEscalate && isEarlyConversation) {
      // Nas primeiras mensagens, converter escalação em flag — agente continua atendendo
      actionTaken = 'flagged_for_review'
      flaggedForReview = true
      console.log(`[agent-executor] Early escalation blocked (${userMessageCount} user msgs) — flagging for review instead`)
    } else if (loopDetected) {
      actionTaken = 'escalated'
    } else if (confidence < 0.40 && !isFirstMessage && !isEarlyConversation) {
      // Só auto-escalar com confiança MUITO baixa (<0.40) e após 3+ mensagens do cliente
      actionTaken = 'escalated'
      forceEscalate = true
      escalateReason = 'Confiança muito baixa após múltiplas interações — escalação automática'
      finalMessage = 'Percebi que não estou conseguindo te ajudar da melhor forma aqui. Vou te conectar com um dos nossos especialistas que vai resolver isso pra você! Um momento! 🙏'
    } else if (confidence < thresholdWarn && !isEarlyConversation) {
      // Só escalar por thresholdWarn após interação suficiente
      actionTaken = 'escalated'
    } else if (confidence < thresholdWarn && isEarlyConversation) {
      // Nas primeiras mensagens, baixa confiança vira flag, não escalação
      actionTaken = 'flagged_for_review'
      flaggedForReview = true
    } else if (confidence < thresholdRespond) {
      actionTaken = 'flagged_for_review'
      flaggedForReview = true
    }

    if (actionTaken === 'escalated') {
      const escalateMsg = forceEscalate
        ? escalateReason
        : guardrailsTriggered.some(g => g.includes('Tema sensível'))
          ? `Tema sensível detectado: ${guardrailsTriggered.filter(g => g.includes('Tema sensível')).join(', ')}`
          : loopDetected
            ? `Loop de respostas detectado: ${loopReason}`
            : `Confidence abaixo do threshold (${confidence.toFixed(2)} < ${thresholdWarn})`
      console.log(`[agent-executor] Escalating: ${escalateMsg}`)

      // OUT-OF-HOURS BLOCK: Fora do expediente (incluindo feriado), NÃO escalar — IA continua atendendo
      if (!businessStatus.isOpen && conversation_id) {
        const isHolidayBlock = isHolidayToday && holidayEscalationMessage
        const blockType = isHolidayBlock ? `holiday_block: ${holidayNameToday}` : `out_of_hours_block: ${businessStatus.reason}`
        console.log(`[agent-executor] Escalation blocked — ${blockType}`)

        // Registrar no audit log
        await supabase.from('ai_audit_log').insert({
          conversation_id,
          agent_id,
          confidence_score: confidence,
          confidence_reason: confidenceReason,
          guardrails_applied: (guardrails || []).map((g: any) => g.rule_content),
          guardrails_triggered: [...guardrailsTriggered, blockType],
          action_taken: isHolidayBlock ? 'holiday_blocked' : 'out_of_hours_blocked',
          response_time_ms: Date.now() - startTime,
        })

        // Se a mensagem do LLM menciona transferência/escalação/indisponibilidade, substituir por resposta adequada
        const mentionsTransfer = /vou (chamar|transferir|encaminhar|escalar)|um momento.*especialista|time especializado|nosso time está (offline|indisponível|fora)|estamos (offline|indisponível|fora do horário)|time.*não está disponível|assim que retornar.*atend/i.test(finalMessage)
        if (mentionsTransfer || !finalMessage.trim()) {
          const nextDay = await getNextBusinessDay(supabase)
          if (isHolidayBlock) {
            finalMessage = holidayEscalationMessage!
          } else {
            finalMessage = `Olá! 😊 Neste momento estamos fora do horário de atendimento, mas eu posso te ajudar! ` +
              `Nosso time retorna no próximo dia útil (${nextDay}). ` +
              `Enquanto isso, me conte o que precisa — consigo resolver muitas questões na hora! 💪`
          }
        }

        actionTaken = 'responded'
        // Não retorna early — continua para salvar mensagem normalmente
      } else if (isHolidayToday && holidayEscalationMessage && conversation_id) {
        // Fallback: holiday block legado (caso businessStatus.isOpen=true mas é feriado — não deveria acontecer)
        console.log(`[agent-executor] Holiday escalation blocked (${holidayNameToday}) — creating follow-up ticket`)

        // Criar ticket no Kanban para follow-up
        try {
          const boardId = conversationData?.kanban_board_id || null
          let targetBoardId = boardId
          let targetStageId: string | null = null

          if (!targetBoardId) {
            const { data: defaultBoard } = await supabase
              .from('kanban_boards')
              .select('id')
              .limit(1)
              .single()
            targetBoardId = defaultBoard?.id || null
          }

          if (targetBoardId) {
            const { data: firstStage } = await supabase
              .from('kanban_stages')
              .select('id')
              .eq('board_id', targetBoardId)
              .order('position', { ascending: true })
              .limit(1)
              .single()
            targetStageId = firstStage?.id || null
          }

          if (targetBoardId && targetStageId) {
            const ticketTitle = `[Feriado] Follow-up: ${conversationData?.conversation_summary?.substring(0, 80) || 'Cliente solicitou atendimento humano'}`
            const nextDayForTicket = await getNextBusinessDay(supabase)

            // Inserir ticket diretamente na tabela de tickets (se existir) ou registrar na conversa
            const { error: ticketError } = await supabase
              .from('kanban_tickets' as any)
              .insert({
                board_id: targetBoardId,
                stage_id: targetStageId,
                title: ticketTitle,
                priority: 'media',
                conversation_id: conversation_id,
                metadata: {
                  holiday_name: holidayNameToday,
                  next_business_day: nextDayForTicket,
                  escalation_reason: escalateMsg,
                  created_by: 'holiday_block',
                },
              } as any)

            if (ticketError) {
              console.warn('[agent-executor] Holiday follow-up ticket creation failed:', ticketError.message)
            }
          }
        } catch (ticketErr) {
          console.warn('[agent-executor] Holiday follow-up ticket creation failed:', (ticketErr as Error).message)
        }

        // Registrar no audit log
        await supabase.from('ai_audit_log').insert({
          conversation_id,
          agent_id,
          confidence_score: confidence,
          confidence_reason: confidenceReason,
          guardrails_applied: (guardrails || []).map((g: any) => g.rule_content),
          guardrails_triggered: [...guardrailsTriggered, `holiday_block: ${holidayNameToday}`],
          action_taken: 'holiday_blocked',
          response_time_ms: Date.now() - startTime,
        })

        // Retornar mensagem de feriado em vez de escalar
        finalMessage = holidayEscalationMessage
        actionTaken = 'responded'
        // Não retorna early — continua para salvar mensagem normalmente
      } else {
        // Escalação normal (não é feriado)
        await supabase
          .from('ai_conversations')
          .update({ handler_type: 'human', status: 'aguardando' })
          .eq('id', conversation_id)

        await supabase.from('ai_audit_log').insert({
          conversation_id,
          agent_id,
          confidence_score: confidence,
          confidence_reason: confidenceReason,
          guardrails_applied: (guardrails || []).map((g: any) => g.rule_content),
          guardrails_triggered: loopDetected ? [...guardrailsTriggered, `loop_detected: ${loopReason}`] : guardrailsTriggered,
          action_taken: loopDetected ? 'loop_escalated' : 'escalated',
          response_time_ms: Date.now() - startTime,
        })

        const escalationMsg = supportConfig.escalationMessage as string | undefined
        const escalationReply = escalationMsg || 'Vou transferir você para um atendente humano. Um momento! 🙏'
        return new Response(JSON.stringify({
          action: 'escalate',
          escalated: true,
          message: escalationReply,
          escalation_message: escalationReply,
          escalation_reason: escalateMsg,
          reason: escalateMsg,
          confidence
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 11. Use whatsapp_instance_id already fetched in step 2 (avoids duplicate query)
    const messageInstanceId = conversationData?.whatsapp_instance_id || null

    // 11a. Salvar mensagem do agente (com retry — NUNCA perder mensagem)
    const messagePayload = {
      conversation_id,
      role: 'assistant',
      content: finalMessage,
      agent_id: agent_id,
      model_used: activeModel,
      confidence,
      confidence_reason: confidenceReason,
      flagged_for_review: flaggedForReview,
      tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      rag_sources: ragSourcesFormatted.length > 0 ? ragSourcesFormatted : null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost_usd: costUSD,
      whatsapp_instance_id: messageInstanceId,
      reasoning_text: sanitizedReasoning || null,
      reasoning_signals: reasoningSignals,
    }

    let savedMessage: { id: string } | null = null

    // Tentativa 1
    const result1 = await supabase.from('ai_messages').insert(messagePayload).select('id').single()
    if (result1.error) {
      console.error(`[agent-executor] Save attempt 1 failed:`, result1.error.message)
      // Retry após 500ms
      await new Promise(r => setTimeout(r, 500))
      const result2 = await supabase.from('ai_messages').insert(messagePayload).select('id').single()
      if (result2.error) {
        console.error(`[agent-executor] CRITICAL: Save attempt 2 also failed:`, result2.error.message, result2.error.details)
        // Salvar na dead-letter para reconciliação posterior
        await supabase.from('dead_letter_messages').insert({
          source: 'agent-executor',
          conversation_id,
          payload: messagePayload,
          error_message: `${result2.error.message}: ${result2.error.details || ''}`,
        }).catch((dlErr: any) => console.error('[agent-executor] Dead-letter insert also failed:', dlErr))
        // Retornar erro ao caller — NÃO enviar via WhatsApp sem salvar no banco
        return new Response(JSON.stringify({
          error: 'Failed to save message to database after retry',
          message: finalMessage,
          confidence,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        savedMessage = result2.data
      }
    } else {
      savedMessage = result1.data
    }

    // 11a-bis. Log to audit trail
    await supabase.from('ai_audit_log').insert({
      conversation_id,
      message_id: savedMessage?.id,
      agent_id,
      confidence_score: confidence,
      confidence_reason: confidenceReason,
      guardrails_applied: (guardrails || []).map((g: any) => g.rule_content),
      guardrails_triggered: guardrailsTriggered,
      action_taken: actionTaken,
      response_time_ms: Date.now() - startTime,
    })

    // 11a-ter. Armazenar memórias da interação (fire-and-forget)
    if (!isPlayground && conversation_id && agent_id) {
      const detectedIntent = analysis?.intent || null
      const sentiment = analysis?.sentiment || null
      
      // Armazenar intent detectado
      if (detectedIntent) {
        supabase.rpc('store_conversation_memory', {
          p_conversation_id: conversation_id,
          p_agent_id: agent_id,
          p_memory_type: 'intent_classification',
          p_content: detectedIntent,
          p_importance_score: 0.8,
          p_metadata: { message_content, confidence: confidence }
        }).catch((e: any) => console.warn('[agent-executor] Failed to store intent memory:', e?.message))
      }
      
      // Armazenar sentimento detectado
      if (sentiment && sentiment !== 'neutral') {
        supabase.rpc('store_conversation_memory', {
          p_conversation_id: conversation_id,
          p_agent_id: agent_id,
          p_memory_type: 'sentiment_snapshot',
          p_content: sentiment,
          p_importance_score: 0.7,
          p_metadata: { confidence: confidence }
        }).catch((e: any) => console.warn('[agent-executor] Failed to store sentiment memory:', e?.message))
      }
      
      // Se conversa foi resolvida, armazenar
      if (forceResolve && resolutionSummary) {
        supabase.rpc('store_conversation_memory', {
          p_conversation_id: conversation_id,
          p_agent_id: agent_id,
          p_memory_type: 'resolved_topic',
          p_content: resolutionSummary,
          p_importance_score: 0.9,
          p_metadata: { resolved_at: new Date().toISOString() }
        }).catch((e: any) => console.warn('[agent-executor] Failed to store resolution memory:', e?.message))
        
        // Também marcar para o cliente
        if (conversationData?.helpdesk_client_id) {
          supabase.rpc('store_customer_memory', {
            p_client_id: conversationData.helpdesk_client_id,
            p_memory_type: 'history_summary',
            p_content: `Resolvido: ${resolutionSummary}`,
            p_source: 'ai_resolver',
            p_confidence_score: confidence,
            p_metadata: { conversation_id, resolved_at: new Date().toISOString() }
          }).catch((e: any) => console.warn('[agent-executor] Failed to store customer resolution memory:', e?.message))
        }
      }
      
      // Coletar exemplo de treinamento se confiança for alta
      if (confidence >= 0.8 && message_content && finalMessage) {
        supabase.rpc('collect_training_example', {
          p_conversation_id: conversation_id,
          p_agent_id: agent_id,
          p_user_message: message_content,
          p_agent_response: finalMessage,
          p_quality_score: confidence,
          p_category: detectedIntent,
          p_response_time_ms: Date.now() - startTime
        }).catch((e: any) => console.warn('[agent-executor] Failed to collect training example:', e?.message))
      }
    }

    // 11b. Auto-resolução se LLM detectou resolução explícita do problema
    const canClose = supportConfig.canCloseTicket !== false
    if (forceResolve && resolutionSummary && canClose) {
      // Classificar ticket (categoria/módulo) antes de fechar, se ainda não classificado
      const { data: convCheck } = await supabase
        .from('ai_conversations')
        .select('ticket_category_id')
        .eq('id', conversation_id)
        .single()

      if (!convCheck?.ticket_category_id) {
        console.log(`[agent-executor] Classifying ticket before auto-resolve...`)
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ticket-category-classifier`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ conversation_id, force_reclassify: false }),
          })
          console.log(`[agent-executor] Ticket classified successfully`)
        } catch (e) {
          console.warn(`[agent-executor] Classification failed (non-blocking):`, e)
        }
      }

      // Gerar descrição detalhada do ticket (fire-and-forget)
      supabase.functions.invoke('generate-ticket-description', { body: { conversation_id } })
        .catch((e: any) => console.warn('[agent-executor] generate-ticket-description error:', e.message))

      console.log(`[agent-executor] Auto-resolving conversation: ${resolutionSummary}`)
      const nowMs = Date.now()
      const resolvedAt = new Date().toISOString()
      const resolutionTimeSeconds = conversationData?.started_at
        ? Math.round((nowMs - new Date(conversationData.started_at).getTime()) / 1000)
        : null

      // Buscar etapa "Fechado por IA" (is_ai_validation) no board atual
      let aiValidationStageId: string | null = null
      if (conversationData?.kanban_board_id) {
        const { data: aiValStage, error: aiValErr } = await supabase
          .from('kanban_stages')
          .select('id')
          .eq('board_id', conversationData.kanban_board_id)
          .eq('is_ai_validation', true)
          .eq('active', true)
          .maybeSingle()
        aiValidationStageId = aiValStage?.id || null
        console.log(`[agent-executor] AI validation stage lookup: board=${conversationData.kanban_board_id}, found=${aiValidationStageId}, error=${aiValErr?.message || 'none'}`)
      } else {
        console.log(`[agent-executor] No kanban_board_id on conversation ${conversation_id}, skipping AI validation stage lookup`)
      }

      // Gerar mensagem de encerramento personalizada via LLM
      let closingMessage: string | null = null
      try {
        const customerName = (conversationData as any)?.customer_name || 'cliente'
        const closingResult = await callOpenRouter({
          model: activeModel,
          messages: [
            {
              role: 'user',
              content: `Você acabou de resolver o atendimento de ${customerName}.\nResumo da resolução: ${resolutionSummary}\n\nGere uma mensagem de encerramento curta (máximo 2 frases), amigável e profissional, agradecendo o contato e colocando-se à disposição. Responda APENAS com a mensagem, sem aspas nem explicações.`,
            },
          ],
          temperature: 0.5,
          max_tokens: 120,
        })
        closingMessage = closingResult.raw_choice?.message?.content?.trim() || null
        console.log(`[agent-executor] Closing message generated: ${closingMessage}`)

        if (closingMessage) {
          await supabase.from('ai_messages').insert({
            conversation_id,
            role: 'assistant',
            content: closingMessage,
            agent_id,
            model_used: activeModel,
            confidence: 1,
            whatsapp_instance_id: conversationData?.whatsapp_instance_id || null,
            source: 'ai_closing',
          }).catch((e: any) => console.warn('[agent-executor] Failed to save closing message:', e.message))
        }
      } catch (e: any) {
        console.warn(`[agent-executor] Closing message generation failed (non-blocking):`, e.message)
      }

      const updatePayload: Record<string, unknown> = {
        ai_resolved: true,
        status: 'finalizado',
        resolved_at: resolvedAt,
        resolution_summary: resolutionSummary,
        resolved_by: agent_id,
        resolution_time_seconds: resolutionTimeSeconds,
        resolution_seconds: resolutionTimeSeconds,
      }

      if (aiValidationStageId) {
        updatePayload.kanban_stage_id = aiValidationStageId
        console.log(`[agent-executor] Moving to AI validation stage: ${aiValidationStageId}`)
      } else {
        // Sem etapa de validação — mover para "Resolvido" em vez de fechar direto
        let resolvidoStageId: string | null = null
        if (conversationData?.kanban_board_id) {
          const { data: resolvidoStage } = await supabase
            .from('kanban_stages')
            .select('id')
            .eq('board_id', conversationData.kanban_board_id)
            .or('slug.ilike.%resolvido%,name.ilike.%resolvido%')
            .eq('active', true)
            .maybeSingle()
          resolvidoStageId = resolvidoStage?.id || null
          console.log(`[agent-executor] Resolvido stage lookup: found=${resolvidoStageId}`)
        }
        if (resolvidoStageId) {
          updatePayload.kanban_stage_id = resolvidoStageId
          console.log(`[agent-executor] No AI validation stage, moving to Resolvido: ${resolvidoStageId}`)
        } else {
          console.log(`[agent-executor] No Resolvido stage found, status=finalizado already set`)
        }
      }

      // AI-only resolve: resolution_seconds = resolution_time_seconds (no human takeover)
      await supabase
        .from('ai_conversations')
        .update(updatePayload)
        .eq('id', conversation_id)

      await supabase.rpc('increment_agent_conversation', { p_agent_id: agent_id })

      // Disparar resumo e avaliação de qualidade (fire-and-forget)
      supabase.functions.invoke('summarize-conversation', { body: { conversation_id } })
        .catch((e: any) => console.warn('[agent-executor] summarize-conversation error:', e.message))
      supabase.functions.invoke('evaluate-service', { body: { conversation_id } })
        .catch((e: any) => console.warn('[agent-executor] evaluate-service error:', e.message))

      console.log(`[agent-executor] Conversation auto-resolved. Status=finalizado. Cost: $${costUSD.toFixed(6)}, RAG docs: ${ragDocuments.length}`)

      return new Response(JSON.stringify({
        message: finalMessage,
        closing_message: closingMessage,
        message_id: savedMessage?.id,
        action: 'resolve',
        resolution_summary: resolutionSummary,
        confidence,
        tools_used: toolsUsed,
        rag_documents_count: ragDocuments.length,
        cost_usd: costUSD
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else if (forceResolve && resolutionSummary && !canClose) {
      console.log(`[agent-executor] Agent detected resolution but canCloseTicket=false, keeping conversation open`)
    }

    // 12. TTS — Gerar resposta em áudio se habilitado no agente (fire-and-forget)
    // Only query TTS config when the agent actually has audio responses enabled
    if (supportConfig.respond_with_audio && finalMessage) {
      try {
        const { data: ttsGlobal } = await supabase
          .from('platform_ai_config')
          .select('enabled, extra_config')
          .eq('feature', 'tts')
          .maybeSingle()

        const globalEnabled = ttsGlobal?.enabled && (ttsGlobal.extra_config as any)?.enabled_for_agents

        if (globalEnabled) {
          console.log(`[agent-executor] TTS enabled for agent, generating audio response`)
          supabase.functions.invoke('text-to-speech', {
            body: {
              text: finalMessage,
              voice: supportConfig.tts_voice || (ttsGlobal.extra_config as any)?.voice || 'nova',
              speed: supportConfig.tts_speed || (ttsGlobal.extra_config as any)?.speed || 1.0,
              conversation_id,
              message_id: savedMessage?.id,
            }
          }).catch((e: any) => console.error('[agent-executor] TTS invocation failed:', e.message))
        }
      } catch (ttsError: any) {
        console.warn('[agent-executor] TTS check failed:', ttsError.message)
      }
    }

    // 13. Atualizar métricas do agente
    await supabase.rpc('increment_agent_conversation', { p_agent_id: agent_id })

    // 14. Log de IA para ticket_ai_logs (fire-and-forget — não bloqueia a resposta)
    if (conversation_id && !isPlayground) {
      supabase.from('ticket_ai_logs').insert({
        ticket_id: conversation_id,
        evento_tipo: forceEscalate ? 'escalonamento' : forceResolve ? 'resumo' : 'resposta',
        prompt_enviado: systemPrompt ? systemPrompt.substring(0, 5000) : null,
        resposta_recebida: finalMessage ? finalMessage.substring(0, 5000) : null,
        modelo_usado: activeModel,
        tokens_input: promptTokens,
        tokens_output: completionTokens,
        confianca: confidence,
        agente_id: agent_id,
        metadata: {
          rag_docs: ragDocuments.length,
          tools_used: toolsUsed,
          cost_usd: costUSD,
          force_escalate: forceEscalate || false,
          force_resolve: forceResolve || false,
        },
      }).then(() => {}, (e: any) => console.error('[agent-executor] ticket_ai_logs insert error:', e?.message))
    }

    // 14b. RAG quality tracking (fire-and-forget)
    if (FLAGS.RAG_QUALITY_TRACKING && ragDocuments.length > 0 && conversation_id && !isPlayground) {
      // Rate RAG docs based on confidence: high confidence = docs were helpful
      const rating = confidence >= 0.8 ? 1 : confidence >= 0.6 ? 0 : -1
      const ratingInserts = ragDocuments.map((doc: any) => ({
        knowledge_id: doc.id,
        conversation_id,
        rating,
        query_text: message_content?.substring(0, 500),
        similarity_score: doc.similarity || null,
      }))
      supabase.from('ai_knowledge_ratings').insert(ratingInserts)
        .then(() => {}, (e: any) => console.warn('[agent-executor] RAG rating error:', e?.message))

      // Update retrieval count
      const docIds = ragDocuments.map((d: any) => d.id)
      supabase.rpc('increment_retrieval_count', { doc_ids: docIds })
        .then(() => {}, (e: any) => console.warn('[agent-executor] retrieval count error:', e?.message))
    }

    console.log(`[agent-executor] Response generated. Confidence: ${confidence.toFixed(2)}, Cost: $${costUSD.toFixed(6)}, RAG docs: ${ragDocuments.length}`)

    // Metricas: registrar execucao do agente
    trackMetric(supabase, {
      edge_function: 'agent-executor',
      event_type: 'agent_response',
      conversation_id: conversation_id,
      latency_ms: latencyMs,
      metadata: {
        agent_id,
        agent_name: agent.name,
        model: activeModel,
        confidence,
        cost_usd: costUSD,
        rag_docs: ragDocuments.length,
        tools_used: toolsUsed,
        tokens: promptTokens + completionTokens,
      },
    })

    return new Response(JSON.stringify({
      message: finalMessage,
      message_id: savedMessage?.id,
      confidence,
      tools_used: toolsUsed,
      rag_documents_count: ragDocuments.length,
      cost_usd: costUSD
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[agent-executor] Error:', errorMessage)

    // Metricas: registrar erro
    trackError(supabase, 'agent-executor', 'agent_error', error)

    // Propagate 402 (no credits) and 408 (timeout) explicitly to caller
    if (error instanceof OpenRouterError) {
      if (error.status === 402) {
        return new Response(JSON.stringify({
          error: 'credits_exhausted',
          message: 'Créditos de IA esgotados. Verifique o saldo da conta OpenRouter.',
          error_code: 402,
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (error.status === 408) {
        return new Response(JSON.stringify({
          error: 'timeout',
          message: 'Tempo de resposta da IA excedido. Tente novamente.',
          error_code: 408,
        }), {
          status: 408,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Agent execution failed. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ── Built-in Tool: customer_search ──
// Pesquisa cliente por nome, CNPJ/CPF, email ou telefone
// Busca local + Sismais Admin, vincula automaticamente se match único
async function executeCustomerSearch(
  supabase: any,
  args: { query?: string },
  conversationId: string | null
): Promise<any> {
  const query = (args.query || '').trim()
  if (!query || query.length < 2) {
    return { found: false, error: 'Query deve ter pelo menos 2 caracteres' }
  }

  console.log(`[agent-executor] customer_search: query_length=${query.length}`)

  // Se a conversa já tem cliente vinculado, retornar dados existentes sem nova busca
  if (conversationId) {
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('helpdesk_client_id')
      .eq('id', conversationId)
      .single()

    if (conv?.helpdesk_client_id) {
      const { data: existingClient } = await supabase
        .from('helpdesk_clients')
        .select('id, name, cnpj, cpf, email, phone, license_status, debt_total, mrr_total, active_contracts_count')
        .eq('id', conv.helpdesk_client_id)
        .single()

      if (existingClient) {
        console.log(`[agent-executor] customer_search: client already linked (${existingClient.name}), returning existing data`)
        const result: any = {
          found: true,
          source: 'already_linked',
          auto_linked: true,
          client_summary: {
            nome: existingClient.name,
            documento: existingClient.cnpj || existingClient.cpf || '',
            email: existingClient.email,
            telefone: existingClient.phone,
            plataformas: [],
            mrr_total: existingClient.mrr_total || 0,
            contratos_ativos: existingClient.active_contracts_count || 0,
            contratos_total: existingClient.active_contracts_count || 0,
            divida_total: existingClient.debt_total || 0,
            faturas_pendentes: 0,
            license_status: existingClient.license_status || 'unknown',
          }
        }
        // GL license check
        try {
          const { data: glData } = await supabase.rpc('gl_search_licenses', {
            p_phone: existingClient.phone || null,
            p_cpf_cnpj: existingClient.cnpj || existingClient.cpf || null,
            p_email: existingClient.email || null,
          })
          if (glData && glData.length > 0) {
            const eligible = glData.some((l: any) => l.support_eligible)
            result.gl_licenses = glData.map((l: any) => ({
              sistema: l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro',
              status: l.status_pessoa,
              suporte: l.support_eligible ? 'Ativo' : 'Bloqueado',
              motivo: l.block_reason,
            }))
            result.support_eligible = eligible
            if (!eligible) {
              result.support_block_reasons = glData
                .filter((l: any) => !l.support_eligible && l.block_reason)
                .map((l: any) => l.block_reason)
            }
          }
        } catch (glSearchErr) {
          console.error('[agent-executor] GL search in customer_search:', glSearchErr)
        }
        return result
      }
    }
  }

  // 1. Search local helpdesk_clients
  const term = `%${query}%`
  const { data: localClients } = await supabase
    .from('helpdesk_clients')
    .select('id, name, cnpj, cpf, email, phone, license_status, debt_total, mrr_total, active_contracts_count')
    .or(`name.ilike.${term},cnpj.ilike.${term},cpf.ilike.${term},email.ilike.${term},phone.ilike.${term},company_name.ilike.${term}`)
    .limit(5)

  // If found exactly 1 local client, auto-link and return
  if (localClients && localClients.length === 1) {
    const client = localClients[0]

    if (conversationId) {
      await supabase.from('ai_conversations')
        .update({ helpdesk_client_id: client.id })
        .eq('id', conversationId)
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'system',
        content: `✅ Cliente vinculado via pesquisa IA: ${client.name}`,
      })
    }

    const localResult: any = {
      found: true,
      source: 'local',
      auto_linked: !!conversationId,
      client_summary: {
        nome: client.name,
        documento: client.cnpj || client.cpf || '',
        email: client.email,
        telefone: client.phone,
        plataformas: [],
        mrr_total: client.mrr_total || 0,
        contratos_ativos: client.active_contracts_count || 0,
        contratos_total: client.active_contracts_count || 0,
        divida_total: client.debt_total || 0,
        faturas_pendentes: 0,
        license_status: client.license_status || 'unknown',
      }
    }
    // GL license check
    try {
      const { data: glData } = await supabase.rpc('gl_search_licenses', {
        p_phone: client.phone || null,
        p_cpf_cnpj: client.cnpj || client.cpf || null,
        p_email: client.email || null,
      })
      if (glData && glData.length > 0) {
        const eligible = glData.some((l: any) => l.support_eligible)
        localResult.gl_licenses = glData.map((l: any) => ({
          sistema: l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro',
          status: l.status_pessoa,
          suporte: l.support_eligible ? 'Ativo' : 'Bloqueado',
          motivo: l.block_reason,
        }))
        localResult.support_eligible = eligible
        if (!eligible) {
          localResult.support_block_reasons = glData
            .filter((l: any) => !l.support_eligible && l.block_reason)
            .map((l: any) => l.block_reason)
        }
      }
    } catch (glSearchErr) {
      console.error('[agent-executor] GL search in customer_search (local):', glSearchErr)
    }
    return localResult
  }

  // 2. Search Sismais Admin via proxy
  try {
    const { data: adminResult, error: adminError } = await supabase.functions.invoke(
      'sismais-admin-proxy',
      { body: { action: 'clients', search: query } }
    )

    if (adminError) {
      console.error('[agent-executor] customer_search admin error:', adminError)
    }

    const adminClients = adminResult?.data || []

    if (adminClients.length === 1) {
      const ac = adminClients[0]

      // Get detailed summary
      const { data: summaryResult } = await supabase.functions.invoke(
        'sismais-admin-proxy',
        { body: { action: 'client_summary', documento: ac.documento } }
      )
      const summary = summaryResult?.data

      // Upsert to local DB
      const isCnpj = (ac.documento || '').replace(/\D/g, '').length > 11
      const { data: upserted } = await supabase
        .from('helpdesk_clients')
        .upsert({
          cnpj: isCnpj ? ac.documento : null,
          cpf: !isCnpj ? ac.documento : null,
          name: ac.nome || 'Cliente Sismais',
          company_name: ac.nome || null,
          email: ac.email || null,
          phone: ac.telefone || null,
          sismais_admin_id: ac.documento,
          license_status: summary?.license_status || (ac.contratos_ativos > 0 ? 'active' : 'cancelled'),
          mrr_total: ac.mrr_total || 0,
          debt_total: summary?.divida_total || 0,
          pending_invoices_count: summary?.faturas_pendentes || 0,
          active_contracts_count: ac.contratos_ativos || 0,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'cnpj', ignoreDuplicates: false })
        .select('id')
        .single()

      if (upserted?.id && conversationId) {
        await supabase.from('ai_conversations')
          .update({ helpdesk_client_id: upserted.id })
          .eq('id', conversationId)
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'system',
          content: `✅ Cliente vinculado via pesquisa IA (Sismais Admin): ${ac.nome}`,
        })
      }

      const adminResult: any = {
        found: true,
        source: 'sismais_admin',
        auto_linked: !!(upserted?.id && conversationId),
        client_summary: summary || {
          nome: ac.nome,
          documento: ac.documento,
          email: ac.email,
          telefone: ac.telefone,
          plataformas: ac.plataformas || [],
          mrr_total: ac.mrr_total || 0,
          contratos_ativos: ac.contratos_ativos || 0,
          contratos_total: ac.contratos_count || 0,
          divida_total: 0,
          faturas_pendentes: 0,
          license_status: ac.contratos_ativos > 0 ? 'active' : 'cancelled',
        }
      }
      // GL license check
      try {
        const { data: glData } = await supabase.rpc('gl_search_licenses', {
          p_phone: ac.telefone || null,
          p_cpf_cnpj: ac.documento || null,
          p_email: ac.email || null,
        })
        if (glData && glData.length > 0) {
          const eligible = glData.some((l: any) => l.support_eligible)
          adminResult.gl_licenses = glData.map((l: any) => ({
            sistema: l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro',
            status: l.status_pessoa,
            suporte: l.support_eligible ? 'Ativo' : 'Bloqueado',
            motivo: l.block_reason,
          }))
          adminResult.support_eligible = eligible
          if (!eligible) {
            adminResult.support_block_reasons = glData
              .filter((l: any) => !l.support_eligible && l.block_reason)
              .map((l: any) => l.block_reason)
          }
        }
      } catch (glSearchErr) {
        console.error('[agent-executor] GL search in customer_search (admin):', glSearchErr)
      }
      return adminResult
    }

    if (adminClients.length > 1) {
      return {
        found: false,
        multiple_results: true,
        count: adminClients.length,
        results: adminClients.slice(0, 3).map((c: any) => ({
          nome: c.nome,
          documento: c.documento,
          status: c.status_geral,
        })),
        message: `Encontrados ${adminClients.length} clientes. Use os dados da conversa para identificar o correto.`
      }
    }
  } catch (err) {
    console.error('[agent-executor] customer_search admin search error:', err)
  }

  // If local had multiple results
  if (localClients && localClients.length > 1) {
    return {
      found: false,
      multiple_results: true,
      count: localClients.length,
      results: localClients.slice(0, 3).map((c: any) => ({
        nome: c.name,
        documento: c.cnpj || c.cpf,
      })),
      message: `Encontrados ${localClients.length} clientes locais. Use os dados da conversa para identificar o correto.`
    }
  }

  return { found: false, message: 'Nenhum cliente encontrado com os termos informados.' }
}
