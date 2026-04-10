# Agent Platform v2.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AI agents configuration experience with a conversational builder, visual hub with metrics, and analytics dashboard — making it the simplest and most intelligent agent platform in the world.

**Architecture:** Split-screen Agent Builder (chat + live preview) powered by a new `agent-builder-ai` edge function. Agent Hub redesigned with visual cards and inline metrics. Analytics tab with comparative performance. All new components in `src/components/agent-builder/` and `src/components/agent-hub/`.

**Tech Stack:** React 18 + TypeScript + TailwindCSS + shadcn/ui + TanStack React Query + Supabase Edge Functions (Deno) + OpenRouter LLM

**Spec:** `docs/superpowers/specs/2026-04-02-agent-platform-v2-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/pages/AgentBuilder.tsx` | Split-screen page: chat left, preview right |
| `src/components/agent-builder/BuilderChat.tsx` | Chat conversacional with IA configuradora |
| `src/components/agent-builder/BuilderPreview.tsx` | Live preview container with sections |
| `src/components/agent-builder/PreviewPersonality.tsx` | Personality summary section |
| `src/components/agent-builder/PreviewSkills.tsx` | Skill chips with toggle |
| `src/components/agent-builder/PreviewTools.tsx` | Tool mini-cards with toggle |
| `src/components/agent-builder/PreviewChannels.tsx` | WhatsApp instance checkboxes |
| `src/components/agent-builder/PreviewKnowledge.tsx` | KB product and category config |
| `src/components/agent-builder/PreviewConfig.tsx` | Advanced params (model, confidence, etc.) |
| `src/components/agent-builder/PreviewTestChat.tsx` | Inline test chat using playground mode |
| `src/components/agent-builder/SkillDetailPanel.tsx` | Slide-over panel for skill details |
| `src/components/agent-builder/ToolDetailPanel.tsx` | Slide-over panel for tool details |
| `src/components/agent-hub/AgentCard.tsx` | Visual card with inline metrics |
| `src/components/agent-hub/AgentAnalytics.tsx` | Performance dashboard tab |
| `src/components/agent-hub/TemplateSelector.tsx` | Template cards modal |
| `src/hooks/useAgentBuilder.ts` | Builder state management (config, chat, preview) |
| `src/hooks/useAgentMetrics.ts` | Performance metrics per agent |
| `src/hooks/useAgentTemplates.ts` | Template definitions and application |
| `supabase/functions/agent-builder-ai/index.ts` | Edge function: IA that generates agent config from text |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Agents.tsx` | Replace with Agent Hub (cards grid + analytics tab) |
| `src/App.tsx` | Add route `/agents/builder/:id?` |

### Removed (after migration complete)
| File | Reason |
|------|--------|
| `src/components/agents/AgentFormDialog.tsx` | Replaced by AgentBuilder |
| `src/components/agents/form-tabs/*` | Replaced by Preview components |

---

## Task 1: Agent Builder Edge Function (`agent-builder-ai`)

**Files:**
- Create: `supabase/functions/agent-builder-ai/index.ts`

This is the brain of the system — the IA that interprets natural language and generates agent configurations.

- [ ] **Step 1: Create edge function scaffold**

```typescript
// supabase/functions/agent-builder-ai/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

const BUILDER_MODEL = 'google/gemini-2.5-flash-preview'

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

      const parsed = JSON.parse(llmResult.content || '{}')
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
        model: 'google/gemini-2.5-flash-preview',
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

      const parsed = JSON.parse(llmResult.content || '{}')
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

      const parsed = JSON.parse(llmResult.content || '{}')
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
```

- [ ] **Step 2: Deploy and verify**

```bash
npx supabase functions deploy agent-builder-ai --project-ref pomueweeulenslxvsxar
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-builder-ai/
git commit -m "feat(agent-builder): add agent-builder-ai edge function for conversational config"
```

---

## Task 2: Builder State Hook (`useAgentBuilder`)

**Files:**
- Create: `src/hooks/useAgentBuilder.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useAgentBuilder.ts
import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface AgentConfig {
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
  skills: string[]
  tools: string[]
  whatsapp_instances: string[]
  color: string
  priority: number
  is_active: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const DEFAULT_CONFIG: AgentConfig = {
  name: '',
  specialty: 'support',
  description: '',
  tone: 'empathetic',
  language: 'pt-BR',
  system_prompt: '',
  model: 'google/gemini-2.5-flash-preview',
  temperature: 0.3,
  max_tokens: 1200,
  confidence_threshold: 0.70,
  rag_enabled: true,
  rag_top_k: 5,
  rag_similarity_threshold: 0.75,
  knowledge_base_filter: {},
  skills: [],
  tools: [],
  whatsapp_instances: [],
  color: '#45E5E5',
  priority: 50,
  is_active: true,
}

export function useAgentBuilder(agentId?: string) {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // Fetch available skills, tools, products, instances for context
  const { data: builderContext } = useQuery({
    queryKey: ['agent-builder-context'],
    queryFn: async () => {
      const [skillsRes, toolsRes, productsRes, instancesRes] = await Promise.all([
        supabase.from('ai_agent_skills').select('id, name, description, category').eq('is_active', true),
        supabase.from('ai_agent_tools').select('id, name, display_name, description').eq('is_active', true),
        supabase.from('knowledge_products').select('id, name, slug').eq('is_active', true),
        (supabase as any).from('uazapi_instances_public').select('id, instance_name, phone_number').eq('is_active', true),
      ])
      return {
        available_skills: skillsRes.data || [],
        available_tools: toolsRes.data || [],
        available_products: productsRes.data || [],
        available_instances: instancesRes.data || [],
      }
    },
  })

  // Load existing agent if editing
  useQuery({
    queryKey: ['agent-builder-load', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId!)
        .single()
      if (agent) {
        setConfig({
          name: agent.name || '',
          specialty: agent.specialty || 'support',
          description: agent.description || '',
          tone: (agent as any).tone || 'empathetic',
          language: (agent as any).language || 'pt-BR',
          system_prompt: agent.system_prompt || '',
          model: agent.model || 'google/gemini-2.5-flash-preview',
          temperature: Number(agent.temperature) || 0.3,
          max_tokens: agent.max_tokens || 1200,
          confidence_threshold: Number(agent.confidence_threshold) || 0.70,
          rag_enabled: agent.rag_enabled ?? true,
          rag_top_k: agent.rag_top_k || 5,
          rag_similarity_threshold: Number(agent.rag_similarity_threshold) || 0.75,
          knowledge_base_filter: (agent.knowledge_base_filter as any) || {},
          skills: [],  // loaded separately
          tools: [],   // loaded separately
          whatsapp_instances: (agent as any).whatsapp_instances || [],
          color: (agent as any).color || '#45E5E5',
          priority: agent.priority || 50,
          is_active: agent.is_active ?? true,
        })
        setChatMessages([{
          id: 'loaded',
          role: 'assistant',
          content: `Agente **${agent.name}** carregado para edição. O que você gostaria de ajustar?`,
          timestamp: new Date(),
        }])
      }
      return agent
    },
  })

  // Send message to builder AI
  const sendMessage = useCallback(async (userMessage: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMsg])
    setIsGenerating(true)

    try {
      const isFirstMessage = chatMessages.length === 0 || (chatMessages.length === 1 && chatMessages[0].id === 'welcome')
      const action = isFirstMessage && !agentId ? 'generate' : 'adjust'

      const { data, error } = await supabase.functions.invoke('agent-builder-ai', {
        body: {
          action,
          description: action === 'generate' ? userMessage : undefined,
          instruction: action === 'adjust' ? userMessage : undefined,
          current_config: action === 'adjust' ? config : undefined,
          context: builderContext,
        }
      })

      if (error) throw new Error(error.message)

      if (action === 'generate' && data?.config) {
        setConfig(prev => ({ ...prev, ...data.config }))
      } else if (action === 'adjust' && data?.changes) {
        setConfig(prev => ({ ...prev, ...data.changes }))
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.explanation || 'Configuração atualizada.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, assistantMsg])

      // Show suggestions as follow-up
      if (data?.suggestions?.length > 0) {
        const sugMsg: ChatMessage = {
          id: `suggestion-${Date.now()}`,
          role: 'assistant',
          content: `💡 **Sugestões:**\n${data.suggestions.map((s: string) => `- ${s}`).join('\n')}`,
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, sugMsg])
      }
    } catch (err) {
      toast.error('Erro ao processar: ' + (err as Error).message)
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Desculpe, tive um problema ao processar. Pode tentar de novo?',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMsg])
    } finally {
      setIsGenerating(false)
    }
  }, [chatMessages, config, builderContext, agentId])

  // Ask AI to explain something
  const askExplanation = useCallback(async (question: string) => {
    setIsGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('agent-builder-ai', {
        body: { action: 'explain', question, context: builderContext }
      })
      if (error) throw new Error(error.message)

      const msg: ChatMessage = {
        id: `explain-${Date.now()}`,
        role: 'assistant',
        content: data?.explanation || 'Sem explicação disponível.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, msg])
    } catch (err) {
      toast.error('Erro: ' + (err as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }, [builderContext])

  // Update config directly (from preview interactions)
  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])

  // Toggle skill on/off
  const toggleSkill = useCallback((skillId: string) => {
    setConfig(prev => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter(id => id !== skillId)
        : [...prev.skills, skillId],
    }))
  }, [])

  // Toggle tool on/off
  const toggleTool = useCallback((toolId: string) => {
    setConfig(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(id => id !== toolId)
        : [...prev.tools, toolId],
    }))
  }, [])

  // Toggle WhatsApp instance
  const toggleInstance = useCallback((instanceId: string) => {
    setConfig(prev => ({
      ...prev,
      whatsapp_instances: prev.whatsapp_instances.includes(instanceId)
        ? prev.whatsapp_instances.filter(id => id !== instanceId)
        : [...prev.whatsapp_instances, instanceId],
    }))
  }, [])

  // Save agent to database
  const saveAgent = useMutation({
    mutationFn: async () => {
      const payload = {
        name: config.name,
        specialty: config.specialty,
        description: config.description,
        system_prompt: config.system_prompt,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        confidence_threshold: config.confidence_threshold,
        rag_enabled: config.rag_enabled,
        rag_top_k: config.rag_top_k,
        rag_similarity_threshold: config.rag_similarity_threshold,
        knowledge_base_filter: config.knowledge_base_filter,
        whatsapp_instances: config.whatsapp_instances,
        color: config.color,
        priority: config.priority,
        is_active: config.is_active,
        channel_type: 'whatsapp',
        tone: config.tone,
        language: config.language,
      }

      if (agentId) {
        const { error } = await supabase.from('ai_agents').update(payload).eq('id', agentId)
        if (error) throw error
        return agentId
      } else {
        const { data, error } = await supabase.from('ai_agents').insert(payload).select('id').single()
        if (error) throw error
        return data.id
      }
    },
    onSuccess: () => {
      toast.success(agentId ? 'Agente atualizado!' : 'Agente criado e publicado!')
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + err.message)
    },
  })

  return {
    config,
    chatMessages,
    isGenerating,
    isTesting,
    setIsTesting,
    builderContext,
    sendMessage,
    askExplanation,
    updateConfig,
    toggleSkill,
    toggleTool,
    toggleInstance,
    saveAgent,
    setChatMessages,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAgentBuilder.ts
git commit -m "feat(agent-builder): add useAgentBuilder hook for builder state management"
```

---

## Task 3: Agent Metrics Hook (`useAgentMetrics`)

**Files:**
- Create: `src/hooks/useAgentMetrics.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useAgentMetrics.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface AgentMetric {
  agent_id: string
  agent_name: string
  specialty: string
  color: string
  is_active: boolean
  conversations_today: number
  conversations_week: number
  conversations_month: number
  resolution_rate: number
  avg_confidence: number
  avg_csat: number
  escalation_rate: number
  avg_response_time_ms: number
}

export function useAgentMetrics() {
  return useQuery({
    queryKey: ['agent-metrics'],
    queryFn: async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch agents
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('id, name, specialty, color, is_active, total_conversations, success_rate, avg_confidence, avg_csat')
        .order('priority', { ascending: false })

      if (!agents) return []

      // Fetch today's conversation counts per agent
      const { data: todayCounts } = await supabase
        .from('ai_conversations')
        .select('current_agent_id')
        .gte('started_at', todayStart)

      // Fetch week counts
      const { data: weekCounts } = await supabase
        .from('ai_conversations')
        .select('current_agent_id')
        .gte('started_at', weekStart)

      // Fetch escalation counts (handler_type changed to human)
      const { data: escalations } = await supabase
        .from('ai_conversations')
        .select('current_agent_id')
        .eq('handler_type', 'human')
        .gte('started_at', monthStart)

      const countByAgent = (data: any[] | null, agentId: string) =>
        (data || []).filter(c => c.current_agent_id === agentId).length

      return agents.map(agent => ({
        agent_id: agent.id,
        agent_name: agent.name,
        specialty: agent.specialty,
        color: agent.color || '#45E5E5',
        is_active: agent.is_active,
        conversations_today: countByAgent(todayCounts, agent.id),
        conversations_week: countByAgent(weekCounts, agent.id),
        conversations_month: agent.total_conversations || 0,
        resolution_rate: Number(agent.success_rate) || 0,
        avg_confidence: Number(agent.avg_confidence) || 0,
        avg_csat: Number(agent.avg_csat) || 0,
        escalation_rate: agent.total_conversations
          ? (countByAgent(escalations, agent.id) / agent.total_conversations) * 100
          : 0,
        avg_response_time_ms: 0,
      })) as AgentMetric[]
    },
    refetchInterval: 30_000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAgentMetrics.ts
git commit -m "feat(agent-hub): add useAgentMetrics hook for agent performance data"
```

---

## Task 4: Agent Templates Hook (`useAgentTemplates`)

**Files:**
- Create: `src/hooks/useAgentTemplates.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useAgentTemplates.ts
export interface AgentTemplate {
  id: string
  name: string
  specialty: string
  description: string
  icon: string
  color: string
  defaultPrompt: string
}

const TEMPLATES: AgentTemplate[] = [
  {
    id: 'support',
    name: 'Suporte Técnico',
    specialty: 'support',
    description: 'Atende dúvidas técnicas, resolve problemas e orienta clientes com passo-a-passo',
    icon: '🛠️',
    color: '#45E5E5',
    defaultPrompt: 'Quero um agente de suporte técnico empático que resolva problemas dos clientes com instruções passo-a-passo',
  },
  {
    id: 'financial',
    name: 'Financeiro',
    specialty: 'financial',
    description: 'Consulta faturas, gera boletos/PIX, negocia pagamentos e cobra inadimplentes',
    icon: '💰',
    color: '#FFB800',
    defaultPrompt: 'Quero um agente financeiro profissional que consulte faturas, gere boletos e ajude com cobranças',
  },
  {
    id: 'sales',
    name: 'Vendas / SDR',
    specialty: 'sales',
    description: 'Qualifica leads, apresenta produtos, tira dúvidas comerciais e agenda demonstrações',
    icon: '🎯',
    color: '#16A34A',
    defaultPrompt: 'Quero um agente de vendas amigável que qualifique leads e apresente nossos produtos',
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    specialty: 'onboarding',
    description: 'Guia novos clientes na configuração inicial, ensina funcionalidades e acompanha primeiros passos',
    icon: '🚀',
    color: '#7C3AED',
    defaultPrompt: 'Quero um agente de onboarding que guie novos clientes na configuração e primeiros passos do sistema',
  },
  {
    id: 'retention',
    name: 'Retenção',
    specialty: 'retention',
    description: 'Previne cancelamentos, resolve insatisfações, negocia condições e reconquista clientes',
    icon: '🤝',
    color: '#DC2626',
    defaultPrompt: 'Quero um agente de retenção empático que previna cancelamentos e resolva insatisfações dos clientes',
  },
]

export function useAgentTemplates() {
  return { templates: TEMPLATES }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAgentTemplates.ts
git commit -m "feat(agent-hub): add useAgentTemplates hook with 5 preset templates"
```

---

## Task 5: Agent Builder Page + Chat + Preview Components

**Files:**
- Create: `src/pages/AgentBuilder.tsx`
- Create: `src/components/agent-builder/BuilderChat.tsx`
- Create: `src/components/agent-builder/BuilderPreview.tsx`
- Create: `src/components/agent-builder/PreviewPersonality.tsx`
- Create: `src/components/agent-builder/PreviewSkills.tsx`
- Create: `src/components/agent-builder/PreviewTools.tsx`
- Create: `src/components/agent-builder/PreviewChannels.tsx`
- Create: `src/components/agent-builder/PreviewKnowledge.tsx`
- Create: `src/components/agent-builder/PreviewConfig.tsx`
- Create: `src/components/agent-builder/PreviewTestChat.tsx`
- Modify: `src/App.tsx` (add route)

This is the largest task — the core UI. It should be implemented as a single unit because all components are tightly coupled through the `useAgentBuilder` hook.

**Implementation instructions:**
- Use the spec section 3 (Agent Builder Conversacional) and section 4 (Preview) as the source of truth
- Follow the existing UI patterns: TailwindCSS + shadcn/ui + lucide-react icons
- Follow the GMS design system from CLAUDE.md (navy #10293F, cyan #45E5E5, etc.)
- Split-screen: 60% chat left, 40% preview right
- Chat: input at bottom, messages scrolling up, markdown rendering for assistant messages
- Preview: scrollable sections as defined in spec section 4.1
- Each preview section is a separate component for maintainability
- PreviewSkills: render chips from `builderContext.available_skills`, highlight active ones, toggle on click
- PreviewTools: render mini-cards from `builderContext.available_tools`, highlight active ones, toggle on click
- PreviewChannels: checkboxes from `builderContext.available_instances`
- PreviewTestChat: reuse the existing playground approach (call `agent-executor` with mode: 'playground')
- Add route to App.tsx: `<Route path="/agents/builder/:id?" element={<AdminRoute><AgentBuilder /></AdminRoute>} />`

- [ ] **Step 1: Create all builder components** (see spec sections 3 and 4 for exact layout)
- [ ] **Step 2: Add route to App.tsx**
- [ ] **Step 3: Test manually in browser** — navigate to `/agents/builder`, describe an agent, verify preview updates
- [ ] **Step 4: Commit**

```bash
git add src/pages/AgentBuilder.tsx src/components/agent-builder/ src/App.tsx
git commit -m "feat(agent-builder): add conversational builder page with split-screen chat + preview"
```

---

## Task 6: Agent Hub Redesign (Cards + Analytics)

**Files:**
- Create: `src/components/agent-hub/AgentCard.tsx`
- Create: `src/components/agent-hub/AgentAnalytics.tsx`
- Create: `src/components/agent-hub/TemplateSelector.tsx`
- Modify: `src/pages/Agents.tsx`

**Implementation instructions:**
- Redesign the `/agents` page following spec section 5 (Agent Hub)
- Replace the current list with a responsive grid of `AgentCard` components
- Each AgentCard shows: avatar/color, name, specialty badge, active toggle, 4 inline metrics (conversations today, CSAT, resolution rate, avg confidence), channel icons, skill/tool counts, action buttons (Edit → navigate to `/agents/builder/:id`, Test, Duplicate, More)
- Add tabs: "Agentes" | "Performance"
- "Performance" tab renders `AgentAnalytics` with the ranking table and global metrics from spec section 6
- "Criar de Template" button opens `TemplateSelector` modal with the 5 template cards
- Clicking a template navigates to `/agents/builder?template=<id>`
- Follow GMS design system from CLAUDE.md

- [ ] **Step 1: Create AgentCard, AgentAnalytics, TemplateSelector components**
- [ ] **Step 2: Refactor Agents.tsx to use new components**
- [ ] **Step 3: Test manually** — verify cards render, metrics show, templates open builder
- [ ] **Step 4: Commit**

```bash
git add src/components/agent-hub/ src/pages/Agents.tsx
git commit -m "feat(agent-hub): redesign agents page with visual cards, metrics, and templates"
```

---

## Task 7: Detail Panels (Skills + Tools)

**Files:**
- Create: `src/components/agent-builder/SkillDetailPanel.tsx`
- Create: `src/components/agent-builder/ToolDetailPanel.tsx`

**Implementation instructions:**
- Slide-over panels (shadcn/ui Sheet) that open when clicking a skill chip or tool card in the preview
- SkillDetailPanel: shows skill name, description, category, trigger keywords, toggle, custom override textarea, and "Explain" button that calls `askExplanation()`
- ToolDetailPanel: shows tool name, description, function type, parameters schema (formatted), toggle, and "Test" button placeholder
- Both panels close on outside click or X button

- [ ] **Step 1: Create both panel components**
- [ ] **Step 2: Integrate with BuilderPreview** — wire click handlers on skills/tools to open panels
- [ ] **Step 3: Test** — click a skill → panel opens with details, toggle works
- [ ] **Step 4: Commit**

```bash
git add src/components/agent-builder/SkillDetailPanel.tsx src/components/agent-builder/ToolDetailPanel.tsx
git commit -m "feat(agent-builder): add skill and tool detail panels with AI explanations"
```

---

## Task 8: Integration Testing + Cleanup

- [ ] **Step 1: Full flow test** — Create agent via builder → verify it appears in hub → edit it → test it
- [ ] **Step 2: Template flow test** — Click template → builder opens → preview filled → publish → hub shows new agent
- [ ] **Step 3: Analytics test** — Verify metrics tab shows data for existing agents
- [ ] **Step 4: Mobile responsive check** — Verify builder works on smaller screens
- [ ] **Step 5: Remove old form** — Delete `AgentFormDialog.tsx` and `form-tabs/` if all flows work via builder
- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(agent-platform-v2): complete agent builder + hub + analytics redesign"
```
