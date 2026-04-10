import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { getModelConfig } from '../_shared/get-model-config.ts'
import { DEFAULT_CONTENT_MODEL } from '../_shared/default-models.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const FEATURE_KEY = 'generate_ticket_description'
const FALLBACK_MODEL = DEFAULT_CONTENT_MODEL

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const body = await req.json().catch(() => ({}))
    const { conversation_id } = body

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'conversation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[generate-ticket-description] Generating for conversation ${conversation_id}`)

    // Buscar modelo configurável via platform_ai_config (permite trocar no dashboard)
    const modelConfig = await getModelConfig(supabase, FEATURE_KEY, FALLBACK_MODEL, 0.1, 1200)

    // Fetch messages, categories and modules in parallel
    const [messagesResult, categoriesResult, modulesResult] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(20),
      supabase
        .from('ticket_categories')
        .select('id, name, description')
        .eq('active', true)
        .order('sort_order'),
      supabase
        .from('ticket_modules')
        .select('id, name')
        .eq('active', true)
        .order('name'),
    ])

    if (messagesResult.error) throw messagesResult.error

    const messages = messagesResult.data || []
    const categories = categoriesResult.data || []
    const modules = modulesResult.data || []

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No messages found for this conversation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formatar conversa para o LLM
    const conversationText = messages.map(m => {
      const roleLabel = m.role === 'user' ? 'CLIENTE' : m.role === 'assistant' ? 'AGENTE' : 'SISTEMA'
      return `[${roleLabel}]: ${m.content}`
    }).join('\n\n')

    // Montar listas numeradas para classificação (mais confiável que UUIDs para LLMs)
    const categoryMap = categories.map((c, i) => ({ idx: i + 1, ...c }))
    const moduleMap = modules.map((m, i) => ({ idx: i + 1, ...m }))

    const categoryList = categoryMap.length > 0
      ? categoryMap.map(c => `${c.idx}. ${c.name}${c.description ? ` — ${c.description}` : ''}`).join('\n')
      : ''
    const moduleList = moduleMap.length > 0
      ? moduleMap.map(m => `${m.idx}. ${m.name}`).join('\n')
      : ''

    const classificationSection = categoryList ? `

CATEGORIAS DISPONÍVEIS (responda com o NÚMERO):
${categoryList}
${moduleList ? `\nMÓDULOS DISPONÍVEIS (responda com o NÚMERO):\n${moduleList}` : ''}` : ''

    const prompt = `Você é um especialista em suporte técnico de sistemas de gestão empresarial.
Analise a conversa de atendimento abaixo e extraia as informações estruturadas do problema.
${classificationSection}

Responda APENAS em JSON válido com este formato exato:
{
  "titulo": "título curto e descritivo do problema (máximo 80 caracteres)",
  "sistema": "GMS Desktop|GMS Web|Maxpro|Outro",
  "modulo": "nome do módulo ou funcionalidade afetada",
  "resumo": "resumo do problema em 1-2 frases claras",
  "detalhe": "descrição detalhada do problema relatado",
  "passos_reproducao": "passos para reproduzir o problema (se mencionados)",
  "impacto": "quantos usuários ou processos foram afetados",
  "tentativas": "o que já foi tentado para resolver (se mencionado)"${categoryList ? ',\n  "categoria_numero": 0,\n  "modulo_numero": 0' : ''}
}

REGRAS:
- categoria_numero: coloque o NÚMERO da categoria mais adequada da lista acima (ou 0 se nenhuma se aplica).
- modulo_numero: coloque o NÚMERO do módulo mais adequado da lista acima (ou 0 se nenhum se aplica).
- Se uma informação não foi mencionada na conversa, use string vazia "".
- NÃO invente informações. Use apenas o que está na conversa.

CONVERSA:
${conversationText}`

    // Chamar LLM via OpenRouter shared client (com timeout, retry, logging automático)
    const result = await callOpenRouter({
      model: modelConfig.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
      response_format: { type: 'json_object' },
      _logContext: {
        edgeFunction: 'generate-ticket-description',
        conversationId: conversation_id,
      },
    })

    const rawContent = result.content || '{}'

    let ticketDescription: Record<string, any>
    try {
      ticketDescription = JSON.parse(rawContent)
    } catch {
      console.error('[generate-ticket-description] Failed to parse JSON:', rawContent.substring(0, 500))
      throw new Error('Failed to parse LLM JSON response')
    }

    // Normalizar campos de descrição
    const titulo = String(ticketDescription.titulo || '').substring(0, 120)
    const normalized = {
      sistema: String(ticketDescription.sistema || ''),
      modulo: String(ticketDescription.modulo || ''),
      resumo: String(ticketDescription.resumo || ''),
      detalhe: String(ticketDescription.detalhe || ''),
      passos_reproducao: String(ticketDescription.passos_reproducao || ''),
      impacto: String(ticketDescription.impacto || ''),
      tentativas: String(ticketDescription.tentativas || ''),
    }

    // Resolver categoria e módulo pelo número retornado
    const catNum = Number(ticketDescription.categoria_numero) || 0
    const modNum = Number(ticketDescription.modulo_numero) || 0

    const matchedCategory = catNum > 0 ? categoryMap.find(c => c.idx === catNum) || null : null
    const matchedModule = modNum > 0 ? moduleMap.find(m => m.idx === modNum) || null : null

    const validCategoryId = matchedCategory?.id || null
    const validModuleId = matchedModule?.id || null

    console.log(`[generate-ticket-description] model=${result.model_used} category=${validCategoryId} (${matchedCategory?.name || 'none'}) module=${validModuleId} (${matchedModule?.name || 'none'})`)

    // Salvar tudo em ai_conversations em um update
    const updatePayload: Record<string, unknown> = { ticket_description: normalized }
    if (titulo) updatePayload.ticket_subject = titulo
    if (validCategoryId) updatePayload.ticket_category_id = validCategoryId
    if (validModuleId) updatePayload.ticket_module_id = validModuleId

    const { error: updateError } = await supabase
      .from('ai_conversations')
      .update(updatePayload)
      .eq('id', conversation_id)

    if (updateError) {
      console.error('[generate-ticket-description] DB update error:', updateError)
      throw new Error(`Failed to save classification: ${updateError.message}`)
    }

    const durationMs = Date.now() - startTime
    console.log(`[generate-ticket-description] Done in ${durationMs}ms (${result.usage.total_tokens} tokens)`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ticket_description: normalized,
          titulo,
          category_id: validCategoryId,
          category_name: matchedCategory?.name || null,
          module_id: validModuleId,
          module_name: matchedModule?.name || null,
        },
        meta: {
          duration_ms: durationMs,
          model: result.model_used,
          tokens_input: result.usage.prompt_tokens,
          tokens_output: result.usage.completion_tokens,
          cost_usd: result.cost_usd,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[generate-ticket-description] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err), meta: { duration_ms: durationMs } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
