# Sismais AI Agent Platform v2.0 — Design Spec

**Data:** 2026-04-02
**Autor:** CTO + Márcio Saraiva
**Visão:** A plataforma de agentes IA mais inteligente, autônoma e fácil de usar do mundo. Agentes capazes de substituir qualquer atendente sênior em vendas, suporte ou atendimento ao cliente.

---

## 1. Visão e Princípios

### Visão
Criar agentes IA que operam com qualidade de atendente sênior — entendem contexto profundo, resolvem problemas complexos, vendem consultivamente, e sabem quando (e como) escalar. A configuração deve ser tão simples que alguém que nunca usou o sistema configura um agente em 5 minutos.

### Princípios de Design
1. **Conversational-first**: toda configuração acontece por conversa com IA
2. **Zero curva de aprendizado**: se precisa de manual, está errado
3. **IA decide, humano ajusta**: defaults inteligentes, override opcional
4. **Autonomia máxima**: agente resolve sozinho até o limite, escala com contexto completo
5. **Transparência**: o usuário sempre vê o que a IA decidiu e por quê
6. **Performance visível**: métricas sempre acessíveis, nunca escondidas

### Benchmark de Mercado
| Plataforma | Pontos fortes | O que superamos |
|-----------|--------------|----------------|
| Intercom Fin | Zero-config, KB automática | Nosso Builder é conversacional, não formulário |
| Zendesk AI | Wizard 3 passos | Nosso é 1 passo: descreva e pronto |
| ChatGPT Builder | Conversa + preview | Nós adicionamos tools, skills, canais, KB, métricas |
| Relevance AI | Tools como cards | Nós auto-configuramos E permitimos ajuste |
| Tidio Lyro | Preview em tempo real | Nosso preview é interativo (teste inline) |

---

## 2. Arquitetura da Experiência

### 3 Pilares

| Pilar | Rota | Descrição |
|-------|------|-----------|
| **Agent Hub** | `/agents` | Listagem com cards visuais, métricas inline, templates |
| **Agent Builder** | `/agents/builder/:id?` | Criação/edição conversacional com preview em tempo real |
| **Agent Analytics** | `/agents` (tab) | Dashboard comparativo de performance |

### Fluxo Principal
```
Agent Hub → [+ Novo Agente] → Agent Builder (conversa + preview) → Publicar → Agent Hub
         → [Template] → Agent Builder (pré-preenchido) → Ajustar → Publicar
         → [Click card] → Agent Builder (edição)
         → [Tab Performance] → Agent Analytics
```

---

## 3. Agent Builder Conversacional

### 3.1 Layout
- **Split-screen responsivo**: Chat (60% esquerda) + Preview (40% direita)
- **Mobile**: Preview vira tab alternável (Chat | Preview)
- **Header**: nome do agente + status (rascunho/ativo) + botões "Testar" e "Publicar"

### 3.2 Fluxo de Criação (Conversa)

**Passo 1 — Descrição livre**
- IA abre com: "Me conte sobre o agente que você quer criar. O que ele faz? Quem ele atende? Qual o tom ideal?"
- Usuário descreve em texto livre (1-3 frases bastam)
- IA interpreta e gera configuração completa automaticamente

**Passo 2 — IA apresenta resultado**
- Preview à direita atualiza com a configuração gerada
- IA no chat explica o que fez: "Criei o agente X com especialidade Y. Ativei as skills A, B, C porque... Conectei as tools D, E porque..."
- IA pergunta: "Quer ajustar algo?"

**Passo 3 — Ajustes conversacionais**
- Usuário conversa para ajustar: "Quero ele mais formal", "Tira a skill de vendas", "Adiciona a ferramenta do Asaas"
- Cada ajuste atualiza o preview em tempo real
- IA confirma cada mudança

**Passo 4 — Teste**
- Botão "Testar" no preview abre chat simulado
- Usuário conversa com o agente como se fosse um cliente
- Pode voltar ao Builder e ajustar baseado no teste

**Passo 5 — Publicar**
- Botão "Publicar" salva e ativa o agente
- IA confirma: "Agente X está ativo nos canais Y, Z. Ele vai começar a atender agora."

### 3.3 Edição de Agente Existente
- Mesmo layout split-screen
- Chat mostra histórico de configuração
- Preview mostra estado atual
- Usuário ajusta conversando: "Mude o tom para mais empático" → IA atualiza

### 3.4 IA Assistiva
- Usuário pode perguntar sobre qualquer elemento: "O que é RAG?", "Para que serve essa skill?"
- IA explica com exemplos práticos do contexto do agente
- Ícone "?" em cada seção do preview abre tooltip contextual

---

## 4. Preview em Tempo Real

### 4.1 Estrutura do Preview
```
┌─────────────────────────────────┐
│ 🤖 Nome do Agente    [Ativo ✓] │
│ Especialidade: Suporte Técnico  │
│ Tom: Empático | Idioma: PT-BR   │
├─────────────────────────────────┤
│ 📝 Personalidade                │
│ "Agente especializado em..."    │
│ (2-3 frases resumo do prompt)   │
├─────────────────────────────────┤
│ 🧠 Skills Ativas               │
│ [WhatsApp Style ✓] [Anti-Aluc ✓]│
│ [Emocional ✓] [Passo-a-passo ✓]│
│ (chips clicáveis com toggle)    │
├─────────────────────────────────┤
│ 🔧 Ferramentas                  │
│ ┌──────────┐ ┌──────────┐      │
│ │ Asaas    │ │ Buscar   │      │
│ │ Faturas ✓│ │ Cliente ✓│      │
│ └──────────┘ └──────────┘      │
│ (mini-cards com toggle)         │
├─────────────────────────────────┤
│ 📱 Canais                       │
│ ☑ Suporte  ☑ Financeiro  ☐ Dev │
├─────────────────────────────────┤
│ 📚 Base de Conhecimento         │
│ Produto: Maxpro                 │
│ Categorias: fiscal, estoque...  │
├─────────────────────────────────┤
│ 📊 Config                       │
│ Confiança mín: 70%             │
│ Modelo: Gemini 2.5 Flash       │
├─────────────────────────────────┤
│      [ 🧪 Testar Agente ]      │
└─────────────────────────────────┘
```

### 4.2 Interatividade do Preview
- **Chips de skills**: click → painel lateral com descrição, exemplos, toggle, campo de override
- **Cards de tools**: click → painel com descrição, parâmetros, teste individual
- **Canais**: checkboxes diretas no preview
- **Configurações**: editáveis diretamente (sliders, dropdowns)
- Toda mudança feita no preview reflete no chat: "Você desativou a skill X. Posso ajudar com mais algo?"

### 4.3 Teste Inline
- Botão "Testar Agente" substitui o preview por um chat simulado
- Usa a edge function `agent-executor` em modo playground
- Header mostra: "Testando como cliente" + botão "Voltar ao Builder"
- Métricas do teste: confiança, RAG docs usados, tools chamadas, latência

---

## 5. Agent Hub (Listagem)

### 5.1 Layout
- **Header**: "Agentes IA" + botão "+ Novo Agente" + dropdown "Criar de Template"
- **Tabs**: "Agentes" | "Performance"
- **Filtros**: especialidade, status (ativo/inativo), canal
- **Grid de cards** (responsivo: 3 cols desktop, 2 tablet, 1 mobile)

### 5.2 Agent Card
```
┌──────────────────────────────────┐
│ 🟢 Lino                [toggle] │
│ Suporte Técnico · Mais Simples   │
├──────────────────────────────────┤
│ 💬 47 hoje  ⭐ 4.6  ✅ 89%  🎯 82% │
│ conversas   CSAT   resolução confiança│
├──────────────────────────────────┤
│ 📱 Suporte · Financeiro         │
│ 🧠 5 skills · 🔧 3 tools        │
├──────────────────────────────────┤
│ [Editar] [Testar] [Duplicar] [⋯]│
└──────────────────────────────────┘
```

### 5.3 Templates Pré-configurados
Botão "Criar de Template" abre modal com cards:

| Template | Especialidade | Skills auto | Tools auto |
|----------|--------------|-------------|------------|
| Suporte Técnico | support | whatsapp_style, step_by_step, anti_hallucination, emotional_intelligence | customer_search, get_client_history, search_knowledge_base |
| Financeiro | financial | whatsapp_style, anti_hallucination, emotional_intelligence | asaas_find_customer, asaas_list_payments, asaas_get_boleto, asaas_get_pix |
| Vendas / SDR | sales | whatsapp_style, emotional_intelligence | customer_search, guru_list_transactions |
| Onboarding | onboarding | whatsapp_style, step_by_step, emotional_intelligence | customer_search, get_client_contracts |
| Retenção | retention | whatsapp_style, emotional_intelligence, anti_hallucination | customer_search, asaas_list_payments, get_client_history |

Cada template abre o Agent Builder com config pré-preenchida para ajuste.

---

## 6. Agent Analytics (Tab Performance)

### 6.1 Métricas Globais (topo)
- Total de conversas IA hoje/semana/mês
- Taxa de resolução IA global (%)
- CSAT médio global
- Economia estimada (conversas resolvidas sem humano × custo médio)

### 6.2 Ranking de Agentes
Tabela ordenável:
| Agente | Conversas | Resolução IA | CSAT | Confiança Média | Escalações |
|--------|-----------|-------------|------|----------------|------------|

### 6.3 Gráficos
- **Tendência 7/30 dias**: linha por agente (resolução, CSAT, escalações)
- **Heatmap**: horários de pico por agente
- **Top perguntas não respondidas**: oportunidade de enriquecer KB

---

## 7. Edge Function: agent-builder-ai

### 7.1 Responsabilidade
Interpretar descrição em texto livre e gerar configuração completa de agente.

### 7.2 API

**Endpoint:** `POST /functions/v1/agent-builder-ai`

**Request (criação):**
```json
{
  "action": "generate",
  "description": "Quero um agente de suporte para clientes do Maxpro que saiba sobre fiscal e estoque",
  "context": {
    "available_skills": [...],
    "available_tools": [...],
    "available_products": [...],
    "available_instances": [...]
  }
}
```

**Request (ajuste incremental):**
```json
{
  "action": "adjust",
  "current_config": { ... },
  "instruction": "Quero ele mais formal e tire a skill de vendas",
  "context": { ... }
}
```

**Request (explicação):**
```json
{
  "action": "explain",
  "question": "O que é a skill anti_hallucination?",
  "context": { "agent_config": { ... } }
}
```

**Response (generate/adjust):**
```json
{
  "config": {
    "name": "MAX",
    "specialty": "support",
    "description": "Agente especializado em suporte técnico Maxpro...",
    "tone": "empathetic",
    "language": "pt-BR",
    "system_prompt": "...",
    "model": "google/gemini-2.5-flash-preview",
    "temperature": 0.3,
    "max_tokens": 1200,
    "confidence_threshold": 0.70,
    "rag_enabled": true,
    "rag_top_k": 5,
    "rag_similarity_threshold": 0.75,
    "knowledge_base_filter": { "products": ["..."], "categories": ["fiscal", "estoque"] },
    "skills": ["whatsapp_style", "anti_hallucination", "step_by_step_guide"],
    "tools": ["customer_search", "get_client_history", "search_knowledge_base"],
    "whatsapp_instances": ["..."],
    "color": "#45E5E5",
    "priority": 50
  },
  "explanation": "Criei o agente MAX com especialidade suporte...",
  "suggestions": ["Considere ativar a skill 'emotional_intelligence' para melhor lidar com clientes frustrados"]
}
```

**Response (explain):**
```json
{
  "explanation": "A skill anti_hallucination impede que o agente invente informações...",
  "examples": ["Sem a skill: agente pode inventar um procedimento. Com a skill: agente diz 'vou verificar e retorno'"]
}
```

### 7.3 Lógica de Auto-Configuração
1. LLM analisa descrição e extrai: especialidade, produto, tom desejado, funcionalidades
2. Mapeia especialidade → skills padrão (tabela de templates)
3. Mapeia produto + especialidade → tools relevantes
4. Mapeia produto → knowledge_base_filter
5. Gera system_prompt contextualizado usando template da especialidade + ajustes
6. Seleciona todas as instâncias WhatsApp ativas
7. Retorna config + explicação + sugestões

---

## 8. Inteligência de Nível Sênior

### 8.1 O que torna o agente "sênior"
Para que agentes IA substituam atendentes sênior, precisam de:

1. **Contexto profundo do cliente**: histórico completo, contratos, faturas, tickets anteriores, preferências
2. **Raciocínio multi-step**: diagnosticar → investigar → resolver, não apenas responder
3. **Conhecimento especializado**: KB rica e atualizada + RAG de alta qualidade
4. **Inteligência emocional**: detectar frustração, urgência, tom do cliente e adaptar
5. **Autonomia com tools**: consultar sistemas, gerar boletos, criar tickets sem ajuda humana
6. **Saber escalar com contexto**: quando escala, passa briefing completo ao humano

### 8.2 Melhorias para Autonomia Máxima (já existente no pipeline)
- RAG híbrido (semantic + keyword) — ✅ implementado
- Tool calling com loop iterativo (ReAct) — ✅ implementado
- Detecção de loop com cooldown — ✅ implementado
- Fallback chain de modelos LLM — ✅ implementado
- Guardrails anti-alucinação — ✅ implementado
- Contexto de cliente vinculado (GL + Admin) — ✅ implementado
- Histórico de tickets anteriores no prompt — ✅ implementado

### 8.3 Melhorias Futuras (pós v2.0)
- **Aprendizado por feedback**: botão aprovar/rejeitar resposta → ajusta prompt automaticamente
- **Auto-melhoria de KB**: quando agente não sabe responder, sugere artigo para criar
- **Proactive outreach**: agente inicia conversa baseado em eventos (fatura vencida, contrato expirando)
- **Multi-agente colaborativo**: agentes consultam outros agentes para resolver questões cross-domain

---

## 9. Componentes e Arquivos

### 9.1 Novos Componentes

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `AgentBuilderPage` | `src/pages/AgentBuilder.tsx` | Página split-screen |
| `BuilderChat` | `src/components/agent-builder/BuilderChat.tsx` | Chat conversacional com IA |
| `BuilderPreview` | `src/components/agent-builder/BuilderPreview.tsx` | Preview em tempo real |
| `PreviewPersonality` | `src/components/agent-builder/PreviewPersonality.tsx` | Seção personalidade |
| `PreviewSkills` | `src/components/agent-builder/PreviewSkills.tsx` | Chips de skills com toggle |
| `PreviewTools` | `src/components/agent-builder/PreviewTools.tsx` | Cards de tools com toggle |
| `PreviewChannels` | `src/components/agent-builder/PreviewChannels.tsx` | Checkboxes de canais |
| `PreviewKnowledge` | `src/components/agent-builder/PreviewKnowledge.tsx` | Config de KB |
| `PreviewConfig` | `src/components/agent-builder/PreviewConfig.tsx` | Params avançados |
| `PreviewTestChat` | `src/components/agent-builder/PreviewTestChat.tsx` | Chat de teste inline |
| `SkillDetailPanel` | `src/components/agent-builder/SkillDetailPanel.tsx` | Painel lateral skill |
| `ToolDetailPanel` | `src/components/agent-builder/ToolDetailPanel.tsx` | Painel lateral tool |
| `AgentHubPage` | Refactor `src/pages/Agents.tsx` | Nova listagem com cards |
| `AgentCard` | `src/components/agents/AgentCard.tsx` | Card visual com métricas |
| `AgentAnalytics` | `src/components/agents/AgentAnalytics.tsx` | Dashboard de performance |
| `TemplateSelector` | `src/components/agents/TemplateSelector.tsx` | Modal de templates |

### 9.2 Nova Edge Function

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `agent-builder-ai` | `supabase/functions/agent-builder-ai/index.ts` | IA configuradora de agentes |

### 9.3 Hooks

| Hook | Arquivo | Descrição |
|------|---------|-----------|
| `useAgentBuilder` | `src/hooks/useAgentBuilder.ts` | Estado do builder (config, chat, preview) |
| `useAgentMetrics` | `src/hooks/useAgentMetrics.ts` | Métricas de performance por agente |
| `useAgentTemplates` | `src/hooks/useAgentTemplates.ts` | Templates pré-configurados |

### 9.4 Componentes Existentes Mantidos
- `AgentFormDialog.tsx` — removido (substituído pelo Builder)
- `form-tabs/*` — removidos (substituídos pelo Preview)
- `AgentListCard.tsx` — substituído por `AgentCard.tsx`
- `PromptTestChat.tsx` — movido para `PreviewTestChat.tsx`
- `AgentConfigCopilot.tsx` — absorvido pelo `BuilderChat.tsx`

### 9.5 Rota

```tsx
{ path: '/agents/builder/:id?', element: <AgentBuilder /> }
```

---

## 10. Migração e Compatibilidade

### Sem breaking changes no banco
- Tabelas `ai_agents`, `ai_agent_skills`, `ai_agent_tools` permanecem iguais
- Nova edge function `agent-builder-ai` é aditiva
- Agentes existentes continuam funcionando
- Formulário antigo removido apenas quando Builder estiver completo

### Migração de UX
1. Deploy do Builder como rota alternativa (`/agents/builder`)
2. Botão "Novo Editor (Beta)" na listagem atual
3. Validação com usuários reais
4. Substituição completa da rota `/agents`

---

## 11. Fix Crítico Pré-requisito

Antes de qualquer implementação, deploy do fix da variável `activeModel` no `agent-executor`:
```typescript
// Linha 780 (após try/catch do LLM)
const activeModel = llmResult.model_used || primaryModel
```
Sem isso, nenhum agente IA responde em produção.

---

## 12. Fases de Implementação

### Fase 0 — Fix Crítico (imediato)
- Deploy do fix `activeModel` no agent-executor

### Fase 1 — Agent Hub + Templates (sprint 1)
- Redesign da listagem `/agents` com cards visuais
- Métricas inline nos cards
- Templates pré-configurados
- Tab Analytics básica

### Fase 2 — Agent Builder Conversacional (sprint 2-3)
- Edge function `agent-builder-ai`
- Layout split-screen
- Chat conversacional com IA
- Preview em tempo real
- Skills/Tools como chips/cards interativos

### Fase 3 — Teste e Polish (sprint 4)
- Preview test chat inline
- Skill/Tool detail panels
- Analytics avançado (gráficos, heatmap)
- Mobile responsive
- Migração completa (remove formulário antigo)
