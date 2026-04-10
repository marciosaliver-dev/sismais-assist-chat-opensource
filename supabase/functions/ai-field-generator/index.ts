/**
 * ai-field-generator
 *
 * Gera, melhora, simplifica ou traduz texto para qualquer campo de configuração
 * de agentes IA. Usa modelo premium (Claude Sonnet 4) via OpenRouter para
 * resultados de alta qualidade.
 *
 * Entrada:
 *   {
 *     action: 'generate' | 'improve' | 'simplify' | 'translate',
 *     field_type: string,
 *     context: { agent_specialty?, agent_name?, company_name?, tone?, existing_value?, target_language? }
 *   }
 *
 * Saída:
 *   { text: string, tokens_used: number, cost_usd: number }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { getModelConfig, getModelPricing, calculateCost } from '../_shared/get-model-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tipos ──

type Action = 'generate' | 'improve' | 'simplify' | 'translate'

interface FieldContext {
  agent_specialty?: string
  agent_name?: string
  company_name?: string
  company_description?: string
  products_services?: string
  tone?: string
  existing_value?: string
  target_language?: string
  // Campos extras para contextualização rica
  [key: string]: string | undefined
}

interface RequestBody {
  action: Action
  field_type: string
  context: FieldContext
}

// ── Templates de prompt por field_type ──

const FIELD_TEMPLATES: Record<string, string> = {
  system_prompt: `Crie um system prompt profissional e completo para um agente de atendimento ao cliente.

O agente deve:
- Ter personalidade definida e consistente
- Responder sempre em português brasileiro
- Usar formatação WhatsApp (*negrito*, _itálico_)
- Incluir regras de escalação para atendente humano
- Ter guardrails contra alucinação (usar apenas base de conhecimento)
- Ser conciso nas respostas (máximo 3 parágrafos curtos)

Gere entre 300-500 palavras. Responda APENAS com o system prompt.`,

  description: `Crie uma descrição clara e concisa (2-3 frases) para este agente IA.
A descrição deve explicar o papel do agente e como ele ajuda os clientes.
Responda APENAS com a descrição.`,

  greeting: `Crie uma mensagem de saudação acolhedora para quando o agente inicia uma conversa com o cliente.
Deve ser curta (2-3 linhas), incluir emoji com moderação e identificar o agente pelo nome.
Responda APENAS com a saudação.`,

  escalation_rules: `Crie regras claras de escalação para quando o agente deve transferir para um atendente humano.
Inclua: gatilhos (palavras-chave, sentimento, tentativas), mensagem de escalação e prioridade.
Formato: lista numerada. Responda APENAS com as regras.`,

  escalation_message: `Crie uma mensagem empática para quando o agente precisa transferir o cliente para um atendente humano.
Deve ser breve, reconhecer a necessidade e informar que um especialista vai assumir.
Responda APENAS com a mensagem.`,

  warranty_policy: `Crie uma política de garantia clara e profissional para ser usada pelo agente de atendimento.
Inclua: prazo, condições, exclusões e procedimento de acionamento.
Responda APENAS com a política.`,

  refund_policy: `Crie uma política de reembolso/devolução clara e profissional.
Inclua: condições, prazos, procedimento e exceções.
Responda APENAS com a política.`,

  diagnostic_questions: `Crie uma lista de 5-8 perguntas diagnósticas que o agente deve fazer para identificar problemas técnicos.
As perguntas devem ser progressivas: do mais geral ao mais específico.
Formato: lista numerada. Responda APENAS com as perguntas.`,

  common_issues: `Crie uma lista dos 5-10 problemas mais comuns que clientes reportam para este tipo de agente.
Para cada problema, inclua: título curto e solução resumida (1-2 frases).
Formato: lista com "- **Problema:** Solução". Responda APENAS com a lista.`,

  standard_response: `Crie uma resposta padrão profissional e empática para esta situação de atendimento.
A resposta deve ser concisa, usar formatação WhatsApp e ter tom adequado.
Responda APENAS com a resposta.`,

  style: `Descreva o estilo de comunicação ideal para este agente em 2-3 frases.
Inclua: tom, nível de formalidade, uso de emojis e tipo de linguagem.
Responda APENAS com a descrição do estilo.`,

  company_description: `Crie uma descrição da empresa focada no que os agentes de IA precisam saber para atender bem.
Inclua: o que a empresa faz, público-alvo e diferenciais.
Máximo 3 frases. Responda APENAS com a descrição.`,

  products_services: `Liste os principais produtos/serviços da empresa de forma estruturada.
Para cada item: nome e descrição curta (1 frase).
Formato: lista com "- **Nome:** Descrição". Responda APENAS com a lista.`,
}

// ── Instruções por ação ──

function buildActionInstruction(action: Action, fieldType: string, context: FieldContext): string {
  const existingValue = context.existing_value || ''

  switch (action) {
    case 'generate':
      return FIELD_TEMPLATES[fieldType] || `Crie conteúdo profissional para o campo "${fieldType}" de um agente de atendimento ao cliente. Responda APENAS com o conteúdo.`

    case 'improve':
      return `Melhore o texto abaixo mantendo o significado original. Torne-o mais profissional, claro e eficaz.
Mantenha o idioma original. Responda APENAS com o texto melhorado.

Texto atual:
"""
${existingValue}
"""`

    case 'simplify':
      return `Simplifique o texto abaixo. Torne-o mais curto, direto e fácil de entender.
Remova redundâncias sem perder informações essenciais. Responda APENAS com o texto simplificado.

Texto atual:
"""
${existingValue}
"""`

    case 'translate':
      return `Traduza o texto abaixo para ${context.target_language || 'inglês'}.
Mantenha o tom e a formatação. Responda APENAS com a tradução.

Texto:
"""
${existingValue}
"""`
  }
}

function buildSystemMessage(context: FieldContext): string {
  const parts = [
    'Você é um especialista em configuração de agentes de IA para atendimento ao cliente via WhatsApp.',
    'Gere conteúdo de alta qualidade, profissional e prático.',
    'Sempre em português brasileiro, a menos que peçam tradução.',
  ]

  if (context.agent_specialty) {
    const specialtyMap: Record<string, string> = {
      triage: 'triagem e roteamento',
      support: 'suporte técnico',
      financial: 'financeiro e cobranças',
      sales: 'vendas e qualificação de leads',
      sdr: 'prospecção e SDR',
      copilot: 'copiloto para atendentes humanos',
      analytics: 'análise de dados e métricas',
      customer_success: 'customer success e retenção',
      scheduler: 'agendamento',
      nps_collector: 'pesquisa de satisfação',
      knowledge_curator: 'curadoria de base de conhecimento',
    }
    parts.push(`O agente é especializado em: ${specialtyMap[context.agent_specialty] || context.agent_specialty}.`)
  }

  if (context.agent_name) parts.push(`Nome do agente: ${context.agent_name}.`)
  if (context.company_name) parts.push(`Empresa: ${context.company_name}.`)
  if (context.company_description) parts.push(`Sobre a empresa: ${context.company_description}`)
  if (context.products_services) parts.push(`Produtos/serviços: ${context.products_services}`)
  if (context.tone) {
    const toneMap: Record<string, string> = {
      friendly: 'amigável e acolhedor',
      professional: 'profissional e formal',
      technical: 'técnico e preciso',
      empathetic: 'empático e paciente',
      casual: 'casual e descontraído',
    }
    parts.push(`Tom de voz desejado: ${toneMap[context.tone] || context.tone}.`)
  }

  return parts.join('\n')
}

// ── Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { action, field_type, context } = body

    // Validação
    if (!action || !['generate', 'improve', 'simplify', 'translate'].includes(action)) {
      return new Response(JSON.stringify({ error: 'action must be: generate, improve, simplify, or translate' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!field_type?.trim()) {
      return new Response(JSON.stringify({ error: 'field_type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if ((action === 'improve' || action === 'simplify' || action === 'translate') && !context?.existing_value?.trim()) {
      return new Response(JSON.stringify({ error: 'existing_value is required for improve/simplify/translate actions' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar config do modelo premium
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const modelConfig = await getModelConfig(
      supabase,
      'ai_field_generator',
      'anthropic/claude-sonnet-4',
      0.4,
      2000
    )

    // Montar mensagens
    const systemMessage = buildSystemMessage(context || {})
    const userMessage = buildActionInstruction(action, field_type, context || {})

    // Chamar LLM via OpenRouter
    const result = await callOpenRouter({
      model: modelConfig.model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
    })

    const text = result.content?.trim()
    if (!text) {
      throw new Error('Empty response from LLM')
    }

    // Calcular custo
    const pricing = await getModelPricing(supabase, modelConfig.model)
    const costUsd = calculateCost(result.usage.prompt_tokens, result.usage.completion_tokens, pricing)

    // Log
    console.log(JSON.stringify({
      level: 'info',
      fn: 'ai-field-generator',
      action,
      field_type,
      model: result.model_used,
      tokens: result.usage.total_tokens,
      cost_usd: costUsd,
    }))

    // Registrar custo na tabela de logs
    try {
      await supabase.from('ticket_ai_logs').insert({
        action: `field_generate_${action}`,
        details: { field_type, model: result.model_used, tokens: result.usage.total_tokens },
        tokens_used: result.usage.total_tokens,
        cost_usd: costUsd,
      })
    } catch {
      // Silenciar erro de log — não deve impedir a resposta
    }

    return new Response(JSON.stringify({
      text,
      tokens_used: result.usage.total_tokens,
      cost_usd: costUsd,
      model_used: result.model_used,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'ai-field-generator', error: msg }))
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
