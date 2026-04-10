// supabase/functions/agent-builder-ai/index.ts
/**
 * Agent Builder AI — dispatch single-shot por ação para criar/ajustar agentes.
 *
 * ⚠️ Esta função é INTENCIONALMENTE separada de `ai-builder`.
 *
 * Diferenças principais:
 * - agent-builder-ai: 3 actions independentes (generate | adjust | explain),
 *   cada chamada é single-shot sem histórico, retorna JSON direto sem tool
 *   calling. Ideal para power users que sabem o que querem e para ajustes
 *   rápidos (adjust) e educação (explain).
 * - ai-builder: conversa multi-turn com fases guiadas, acumula partial_config,
 *   usa tool calling. Ideal para usuários guiados passo a passo.
 *
 * NÃO consolide essas duas funções — os contratos são fundamentalmente
 * incompatíveis. Ver JSDoc em ai-builder/index.ts para contexto completo e
 * plano da Onda 3 da refatoração do módulo de IA.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'
import { DEFAULT_CONTENT_MODEL } from '../_shared/default-models.ts'

const BUILDER_MODEL = DEFAULT_CONTENT_MODEL

function safeParseLLM(content: string | null | undefined): Record<string, any> {
  try {
    return JSON.parse(content || '{}')
  } catch (e) {
    console.error('[agent-builder-ai] Failed to parse LLM response:', content?.substring(0, 200))
    return {}
  }
}

interface BuilderRequest {
  action: 'generate' | 'adjust' | 'explain'
  description?: string
  instruction?: string
  question?: string
  current_config?: Record<string, any>
  context?: {
    available_skills: Array<{ id: string; name: string; description: string; category: string }>
    available_tools: Array<{ id: string; name: string; display_name: string; description: string }>
    available_products: Array<{ id: string; name: string; slug: string }>
    available_instances: Array<{ id: string; instance_name: string; phone_number: string }>
  }
}

interface AgentConfig {
  name: string
  specialty: string
  description: string
  tone: string
  language: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  confidence_threshold: number
  rag_enabled: boolean
  rag_top_k: number
  rag_similarity_threshold: number
  knowledge_base_filter: { products?: string[]; categories?: string[]; tags?: string[] }
  skills: string[]  // skill IDs
  tools: string[]   // tool IDs
  whatsapp_instances: string[]  // instance IDs
  color: string
  priority: number
}

// Template defaults per specialty
const SPECIALTY_TEMPLATES: Record<string, Partial<AgentConfig>> = {
  support: {
    tone: 'empathetic',
    temperature: 0.3,
    max_tokens: 1200,
    confidence_threshold: 0.70,
    rag_enabled: true,
    rag_top_k: 5,
    rag_similarity_threshold: 0.75,
    color: '#45E5E5',
    priority: 80,
  },
  financial: {
    tone: 'professional',
    temperature: 0.2,
    max_tokens: 1000,
    confidence_threshold: 0.80,
    rag_enabled: true,
    rag_top_k: 3,
    rag_similarity_threshold: 0.80,
    color: '#FFB800',
    priority: 90,
  },
  sales: {
    tone: 'friendly',
    temperature: 0.5,
    max_tokens: 1000,
    confidence_threshold: 0.65,
    rag_enabled: true,
    rag_top_k: 5,
    rag_similarity_threshold: 0.70,
    color: '#16A34A',
    priority: 70,
  },
  onboarding: {
    tone: 'friendly',
    temperature: 0.4,
    max_tokens: 1200,
    confidence_threshold: 0.70,
    rag_enabled: true,
    rag_top_k: 5,
    rag_similarity_threshold: 0.75,
    color: '#7C3AED',
    priority: 60,
  },
  retention: {
    tone: 'empathetic',
    temperature: 0.3,
    max_tokens: 1200,
    confidence_threshold: 0.75,
    rag_enabled: true,
    rag_top_k: 5,
    rag_similarity_threshold: 0.75,
    color: '#DC2626',
    priority: 85,
  },
}

// Skills auto-mapped by specialty
const SPECIALTY_SKILL_NAMES: Record<string, string[]> = {
  support: ['whatsapp_style', 'anti_hallucination', 'step_by_step_guide', 'emotional_intelligence', 'chopped_message_handler'],
  financial: ['whatsapp_style', 'anti_hallucination', 'emotional_intelligence'],
  sales: ['whatsapp_style', 'emotional_intelligence'],
  onboarding: ['whatsapp_style', 'step_by_step_guide', 'emotional_intelligence'],
  retention: ['whatsapp_style', 'anti_hallucination', 'emotional_intelligence'],
}

// Tool names auto-mapped by specialty
const SPECIALTY_TOOL_NAMES: Record<string, string[]> = {
  support: ['customer_search', 'get_client_history', 'search_knowledge_base', 'transfer_to_human'],
  financial: ['customer_search', 'asaas_find_customer', 'asaas_list_payments', 'asaas_get_boleto', 'asaas_get_pix', 'transfer_to_human'],
  sales: ['customer_search', 'guru_list_transactions', 'transfer_to_human'],
  onboarding: ['customer_search', 'get_client_contracts', 'search_knowledge_base', 'transfer_to_human'],
  retention: ['customer_search', 'asaas_list_payments', 'get_client_history', 'transfer_to_human'],
}

function buildSystemPromptForGeneration(): string {
  return `Você é um assistente especializado em criar agentes de IA para atendimento ao cliente.

Dado uma descrição em texto livre, você deve gerar uma configuração completa de agente.

Responda SEMPRE em JSON válido com esta estrutura:
{
  "name": "Nome curto do agente (máx 20 chars)",
  "specialty": "support|financial|sales|onboarding|retention",
  "description": "Descrição de 1-2 frases do que o agente faz",
  "system_prompt": "System prompt completo e detalhado para o agente, em português. Deve incluir: papel, tom, regras de comportamento, quando escalar. Mínimo 500 chars.",
  "explanation": "Explicação em português do que você configurou e por quê (2-3 frases)",
  "suggestions": ["Sugestão 1 de melhoria opcional", "Sugestão 2"]
}

Regras:
- O system_prompt deve ser profissional, detalhado e incluir guardrails anti-alucinação
- O nome deve ser curto e memorável
- A specialty deve mapear para uma das opções válidas
- Sempre inclua instruções de escalação no system_prompt
- O tom deve ser adaptado à specialty (financeiro=profissional, vendas=amigável, suporte=empático)`
}

function buildSystemPromptForAdjust(): string {
  return `Você é um assistente que ajusta configurações de agentes de IA.

Dado a configuração atual e uma instrução de ajuste, retorne a configuração modificada.

Responda SEMPRE em JSON válido com:
{
  "changes": {
    "field_name": "new_value"
  },
  "explanation": "O que foi alterado e por quê",
  "suggestions": ["Sugestão opcional"]
}

Campos alteráveis: name, specialty, description, system_prompt, tone, temperature, max_tokens, confidence_threshold, rag_enabled.
Para skills/tools, use: add_skills, remove_skills, add_tools, remove_tools (arrays de nomes).`
}

function buildSystemPromptForExplain(): string {
  return `Você é um assistente que explica conceitos de configuração de agentes de IA para pessoas não-técnicas.

Explique de forma simples, com exemplos práticos do contexto de atendimento ao cliente.
Responda em JSON: { "explanation": "...", "examples": ["exemplo 1", "exemplo 2"] }`
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
    const body: BuilderRequest = await req.json()
    const { action, context } = body

    if (action === 'generate') {
      const { description } = body
      if (!description) {
        return new Response(JSON.stringify({ error: 'description is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Call LLM to interpret description
      const llmResult = await callOpenRouter({
        model: BUILDER_MODEL,
        messages: [
          { role: 'system', content: buildSystemPromptForGeneration() },
          { role: 'user', content: `Crie um agente de IA baseado nesta descrição:\n\n"${description}"\n\nContexto disponível:\n- Skills: ${context?.available_skills?.map(s => s.name).join(', ') || 'nenhuma'}\n- Tools: ${context?.available_tools?.map(t => t.display_name || t.name).join(', ') || 'nenhuma'}\n- Produtos KB: ${context?.available_products?.map(p => p.name).join(', ') || 'nenhum'}` },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      })

      const parsed = safeParseLLM(llmResult.content)
      const specialty = parsed.specialty || 'support'
      const template = SPECIALTY_TEMPLATES[specialty] || SPECIALTY_TEMPLATES.support

      // Map skill names to IDs
      const skillNames = SPECIALTY_SKILL_NAMES[specialty] || []
      const matchedSkills = (context?.available_skills || [])
        .filter(s => skillNames.includes(s.name))
        .map(s => s.id)

      // Map tool names to IDs
      const toolNames = SPECIALTY_TOOL_NAMES[specialty] || []
      const matchedTools = (context?.available_tools || [])
        .filter(t => toolNames.includes(t.name))
        .map(t => t.id)

      // All instances by default
      const allInstances = (context?.available_instances || []).map(i => i.id)

      const config: AgentConfig = {
        name: parsed.name || 'Novo Agente',
        specialty,
        description: parsed.description || '',
        system_prompt: parsed.system_prompt || '',
        language: 'pt-BR',
        model: DEFAULT_CONTENT_MODEL,
        skills: matchedSkills,
        tools: matchedTools,
        whatsapp_instances: allInstances,
        knowledge_base_filter: {},
        ...template,
        tone: template.tone || 'empathetic',
        temperature: template.temperature || 0.3,
        max_tokens: template.max_tokens || 1200,
        confidence_threshold: template.confidence_threshold || 0.70,
        rag_enabled: template.rag_enabled ?? true,
        rag_top_k: template.rag_top_k || 5,
        rag_similarity_threshold: template.rag_similarity_threshold || 0.75,
        color: template.color || '#45E5E5',
        priority: template.priority || 50,
      }

      // Auto-detect product from description
      if (context?.available_products) {
        const descLower = description.toLowerCase()
        const matchedProduct = context.available_products.find(p =>
          descLower.includes(p.name.toLowerCase()) || descLower.includes(p.slug.toLowerCase())
        )
        if (matchedProduct) {
          config.knowledge_base_filter = { products: [matchedProduct.id] }
        }
      }

      return new Response(JSON.stringify({
        config,
        explanation: parsed.explanation || `Agente ${config.name} criado com especialidade ${specialty}.`,
        suggestions: parsed.suggestions || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'adjust') {
      const { current_config, instruction } = body
      if (!current_config || !instruction) {
        return new Response(JSON.stringify({ error: 'current_config and instruction are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const llmResult = await callOpenRouter({
        model: BUILDER_MODEL,
        messages: [
          { role: 'system', content: buildSystemPromptForAdjust() },
          { role: 'user', content: `Config atual:\n${JSON.stringify(current_config, null, 2)}\n\nInstrução de ajuste: "${instruction}"\n\nSkills disponíveis: ${context?.available_skills?.map(s => s.name).join(', ') || 'nenhuma'}\nTools disponíveis: ${context?.available_tools?.map(t => t.name).join(', ') || 'nenhuma'}` },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      })

      const parsed = safeParseLLM(llmResult.content)
      const changes = parsed.changes || {}

      // Handle skill/tool add/remove
      if (changes.add_skills && context?.available_skills) {
        const newSkillIds = context.available_skills
          .filter(s => changes.add_skills.includes(s.name))
          .map(s => s.id)
        changes.skills = [...(current_config.skills || []), ...newSkillIds]
        delete changes.add_skills
      }
      if (changes.remove_skills && context?.available_skills) {
        const removeIds = context.available_skills
          .filter(s => changes.remove_skills.includes(s.name))
          .map(s => s.id)
        changes.skills = (current_config.skills || []).filter((id: string) => !removeIds.includes(id))
        delete changes.remove_skills
      }
      if (changes.add_tools && context?.available_tools) {
        const newToolIds = context.available_tools
          .filter(t => changes.add_tools.includes(t.name))
          .map(t => t.id)
        changes.tools = [...(current_config.tools || []), ...newToolIds]
        delete changes.add_tools
      }
      if (changes.remove_tools && context?.available_tools) {
        const removeIds = context.available_tools
          .filter(t => changes.remove_tools.includes(t.name))
          .map(t => t.id)
        changes.tools = (current_config.tools || []).filter((id: string) => !removeIds.includes(id))
        delete changes.remove_tools
      }

      return new Response(JSON.stringify({
        changes,
        explanation: parsed.explanation || 'Configuração ajustada.',
        suggestions: parsed.suggestions || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'explain') {
      const { question } = body
      if (!question) {
        return new Response(JSON.stringify({ error: 'question is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const llmResult = await callOpenRouter({
        model: BUILDER_MODEL,
        messages: [
          { role: 'system', content: buildSystemPromptForExplain() },
          { role: 'user', content: question },
        ],
        temperature: 0.5,
        max_tokens: 500,
      })

      const parsed = safeParseLLM(llmResult.content)
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: generate, adjust, explain' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[agent-builder-ai] Error:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
