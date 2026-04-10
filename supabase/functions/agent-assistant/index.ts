import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getModelConfig } from '../_shared/get-model-config.ts'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'
import { DEFAULT_CONTENT_MODEL } from '../_shared/default-models.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { message, agent_config, support_config, conversation_history } = await req.json()

    const config = await getModelConfig(supabase, 'agent_assistant', DEFAULT_CONTENT_MODEL, 0.4, 4000)

    const systemPrompt = `Você é um especialista em engenharia de prompts e configuração de agentes de IA para atendimento ao cliente.

Seu papel é analisar a configuração atual de um agente e sugerir melhorias concretas.

## Configuração atual do agente
- Nome: ${agent_config?.name || 'Não definido'}
- Especialidade: ${agent_config?.specialty || 'Não definida'}
- Tom: ${agent_config?.tone || 'Não definido'}
- Modelo: ${agent_config?.model || 'Não definido'}
- Temperature: ${agent_config?.temperature ?? 'Não definida'}
- System Prompt atual:
"""
${agent_config?.system_prompt || '(vazio)'}
"""

## Support Config
- Empresa: ${support_config?.companyName || 'Não definida'}
- Saudação: ${support_config?.greeting || '(vazia)'}
- Mensagem de escalação: ${support_config?.escalationMessage || '(vazia)'}

## Regras de melhoria
1. Sempre use a estrutura: IDENTIDADE > REGRAS > SAUDAÇÃO > EXEMPLOS > GUARDRAILS
2. Inclua pelo menos 3 exemplos few-shot relevantes para a especialidade
3. Use técnica PASA (Problema → Ação → Solução → Alternativa)
4. Saudação contextual (por horário, cliente novo vs recorrente)
5. Anti-repetição ("nunca repita a mesma frase")
6. Encerramento ativo ("posso ajudar em mais algo?")
7. Regras claras de escalação (máximo N trocas sem resolver)

## Formato de resposta
Responda em JSON com:
{
  "message": "Sua análise e sugestões em texto amigável (markdown permitido)",
  "changes": [
    {
      "field": "system_prompt",
      "label": "System Prompt",
      "before": "trecho atual resumido (max 80 chars)",
      "after": "novo conteúdo completo"
    }
  ]
}

Se não houver mudanças a sugerir, retorne "changes" como array vazio.
Campos válidos para changes: system_prompt, tone, temperature, support_config.greeting, support_config.escalationMessage`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(conversation_history || []).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ]

    const result = await callOpenRouter({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    })

    // Tentar parsear como JSON
    let parsed: { message: string; changes: any[] }
    try {
      const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: result.content || 'Sem resposta', changes: [] }
    } catch {
      parsed = { message: result.content || 'Sem resposta', changes: [] }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[agent-assistant] Error:', error)
    return new Response(JSON.stringify({
      message: 'Desculpe, tive um problema ao analisar. Tente novamente.',
      changes: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
