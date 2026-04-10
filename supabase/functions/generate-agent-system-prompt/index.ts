/**
 * generate-agent-system-prompt
 *
 * Gera um system prompt profissional para um agente IA a partir de uma
 * descrição em linguagem natural. Permite que administradores não-técnicos
 * configurem agentes sem escrever prompts manualmente.
 *
 * Entrada:
 *   { description: string, tone: string, knowledge_summary?: string, escalation_threshold?: number }
 *
 * Saída:
 *   { system_prompt: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { getModelConfig, getModelPricing, calculateCost } from '../_shared/get-model-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TONE_MAP: Record<string, string> = {
  friendly:    'amigável e acolhedor, usando linguagem próxima e descontraída',
  professional: 'profissional e formal, com linguagem clara e objetiva',
  technical:   'técnico e preciso, com terminologia específica da área',
  empathetic:  'empático e paciente, priorizando a compreensão do problema do cliente',
}

const PROMPT_GENERATOR = `Você é especialista em criar system prompts para agentes de atendimento ao cliente.

Com base nas informações abaixo, crie um system prompt completo e profissional em português brasileiro.

O system prompt deve:
1. Definir claramente a especialidade e os limites de atuação do agente
2. Especificar o tom e estilo de comunicação
3. Incluir instruções sobre quando escalar para um agente humano
4. Mencionar os principais tópicos que o agente domina (baseado nos artigos vinculados)
5. Ser direto, sem introduções ou comentários externos
6. Ter entre 200 e 400 palavras

INFORMAÇÕES DO AGENTE:
Descrição: {description}
Tom de resposta: {tone_description}
Threshold de escalação: {threshold}% de confiança (escalar se abaixo disso)
{knowledge_section}

IMPORTANTE: Responda APENAS com o system prompt. Nenhum comentário adicional.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const {
      description,
      tone = 'professional',
      knowledge_summary = '',
      escalation_threshold = 70,
    } = await req.json()

    if (!description?.trim()) {
      return new Response(JSON.stringify({ error: 'description is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const toneDescription = TONE_MAP[tone] || TONE_MAP.professional
    const knowledgeSection = knowledge_summary
      ? `Artigos de conhecimento vinculados:\n${knowledge_summary}`
      : 'Base de conhecimento: não especificada — usar conhecimento geral da empresa'

    const prompt = PROMPT_GENERATOR
      .replace('{description}', description.trim())
      .replace('{tone_description}', toneDescription)
      .replace('{threshold}', String(escalation_threshold))
      .replace('{knowledge_section}', knowledgeSection)

    // Usa modelo premium via config centralizada (Claude Sonnet 4 por padrão)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const modelConfig = await getModelConfig(
      supabase,
      'generate_agent_prompt',
      'anthropic/claude-sonnet-4',
      0.3,
      1200
    )

    const result = await callOpenRouter({
      model: modelConfig.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: modelConfig.max_tokens,
      temperature: modelConfig.temperature,
    })

    const systemPrompt = result.content?.trim()

    if (!systemPrompt) {
      throw new Error('Empty response from LLM')
    }

    console.log(JSON.stringify({
      level: 'info', fn: 'generate-agent-system-prompt',
      chars: systemPrompt.length, tone, threshold: escalation_threshold
    }))

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'generate-agent-system-prompt', error: msg }))
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
