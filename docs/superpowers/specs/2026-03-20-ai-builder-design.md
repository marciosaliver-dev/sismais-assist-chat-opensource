# AI Builder — Spec de Design

> **Data:** 2026-03-20
> **Status:** Aprovado
> **Branch:** `claude/sismais-support-system-JCMCi`

---

## 1. Visao Geral

Plataforma unificada para criacao profissional de agentes IA e skills via interface conversacional com IA, substituindo os 3 caminhos de criacao atuais (`SkillAgentDialog`, `AIConfigurator`, `AIConfig`) por uma unica pagina full-page: `/ai-builder`.

### Objetivos

- Unificar criacao de agentes em 1 caminho (hoje sao 3)
- Criar agentes com fluxo conversacional profundo (10-15 perguntas, estilo Prompt Master 300)
- Criar skills via IA com mesmo padrao PRO
- Selecao de metodos de prompt engineering por tipo de agente
- Corrigir funcionalidade de skills (tabelas inexistentes no banco)
- Eliminar codigo morto e duplicado

---

## 2. Arquitetura

### Rota

- **URL:** `/ai-builder`
- **Acesso:** AdminRoute (somente admins)
- **Pagina:** `src/pages/AIBuilder.tsx`

### Layout

Split-screen full-page:
- **Esquerda (55%):** Chat conversacional com IA (barra de fases + mensagens + input)
- **Direita (45%):** Preview em tempo real (config do agente/skill atualiza conforme chat)
- **Header:** Titulo + 3 tabs (Criar Agente | Criar Skill | Templates)

### Responsividade

- Desktop (>1024px): split 55/45
- Tablet (768-1024px): split 50/50
- Mobile (<768px): toggle entre chat e preview

---

## 3. Fluxo Conversacional Profundo

### Criar Agente — 4 Fases, 10-15 Perguntas

**FASE 1 — IDENTIDADE (3 perguntas)**
- Q1: Objetivo principal do agente
- Q2: Publico-alvo (clientes, leads, internos)
- Q3: Nome e personalidade (formal, amigavel, tecnico)

**FASE 2 — COMPORTAMENTO (4 perguntas)**
- Q4: Cenario ideal passo a passo
- Q5: O que NUNCA deve fazer (limites)
- Q6: Gatilhos de escalacao para humano
- Q7: Saudacao inicial e mensagem de encerramento

**FASE 3 — CONHECIMENTO (3 perguntas)**
- Q8: Base de conhecimento (RAG) — quais temas
- Q9: Perguntas de diagnostico ao cliente
- Q10: 3-5 problemas/situacoes mais comuns

**FASE 4 — AVANCADO (3-4 perguntas opcionais)**
- Q11: Horario de atuacao e mensagem fora do horario
- Q12: Skills/habilidades modulares
- Q13: Regras de negocio especificas
- Q14: Exemplos de conversa ideal (few-shot)

### Criar Skill — 3 Fases, 8 Perguntas

**FASE 1 — DEFINICAO (3 perguntas)**
- Q1: Qual habilidade e o que faz
- Q2: Categoria (atendimento, financeiro, vendas, tecnico, interno)
- Q3: Quando ativar (sempre, keyword, intencao)

**FASE 2 — INSTRUCOES (3 perguntas)**
- Q4: Instrucoes detalhadas
- Q5: Ferramentas/integracoes necessarias
- Q6: Limites e restricoes

**FASE 3 — ATIVACAO (2 perguntas)**
- Q7: Palavras-chave e intencoes de ativacao
- Q8: Quais agentes devem receber essa skill

### Comportamento da IA

- UMA pergunta por vez (nunca 2+)
- Barra de progresso visual por fases
- Preview lateral atualiza em tempo real via `partial_config`
- Respostas vagas → IA aprofunda
- Respostas curtas → IA expande
- Modelo: Gemini 2.5 Pro (via OpenRouter)

---

## 4. Metodos de Prompt Engineering

### Selecao automatica por specialty

| Specialty | Metodo Principal | Descricao |
|-----------|-----------------|-----------|
| triage | Decision Tree | Classificacao rapida por fluxo de decisoes |
| support | Chain of Thought | Raciocinio passo-a-passo para diagnostico |
| financial | PASA | Problem→Agitate→Solution→Action para cobranca |
| sales / sdr | AIDA | Attention→Interest→Desire→Action para vendas |
| copilot | ReAct | Reasoning + Acting para sugestoes ao humano |
| analytics | Structured Output | Dados precisos, tabelas, metricas |
| customer_success | Emotion Method | Empatia e leitura emocional |

### Comportamento na UI

- IA sugere metodo automaticamente baseado no objetivo
- Admin pode trocar via dropdown no painel de preview
- Possibilidade de combinar 2+ metodos (checkboxes)
- Metodos complementares disponives: Self-Reflection, Few-Shot Examples
- Cada metodo injeta `prompt_template` no system prompt gerado

---

## 5. Banco de Dados

### Tabelas a CRIAR

#### `ai_agent_skills`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| name | TEXT NOT NULL | Nome da skill |
| slug | TEXT UNIQUE NOT NULL | Slug unico |
| description | TEXT | Descricao |
| icon | TEXT | Nome do icone Lucide |
| color | TEXT | Hex da cor |
| category | TEXT DEFAULT 'general' CHECK (category IN ('atendimento','financeiro','vendas','tecnico','interno','general')) | Categoria da skill |
| prompt_instructions | TEXT | Instrucoes injetadas no system prompt |
| trigger_keywords | TEXT[] | Palavras que ativam |
| trigger_intents | TEXT[] | Intencoes que ativam |
| tool_ids | TEXT[] | Nomes das ferramentas associadas (ex: 'search_knowledge') |
| auto_activate | BOOLEAN DEFAULT false | Sempre ativa |
| is_active | BOOLEAN DEFAULT true | |
| is_system | BOOLEAN DEFAULT false | Skills built-in |
| sort_order | INT DEFAULT 0 | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `ai_agent_skill_assignments`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| agent_id | UUID FK → ai_agents | |
| skill_id | UUID FK → ai_agent_skills | |
| is_enabled | BOOLEAN DEFAULT true | |
| priority | INT DEFAULT 0 | |
| custom_prompt_override | TEXT | Override por agente |
| custom_config | JSONB | Config extra |
| created_at | TIMESTAMPTZ | |
| UNIQUE(agent_id, skill_id) | | |

#### `ai_prompt_methods`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| name | TEXT NOT NULL | chain_of_thought, aida, pasa, etc. |
| label | TEXT NOT NULL | Chain of Thought, AIDA, etc. |
| description | TEXT | |
| recommended_specialties | TEXT[] | ['support', 'copilot'] |
| prompt_template | TEXT NOT NULL | Template de instrucoes |
| is_active | BOOLEAN DEFAULT true | |
| sort_order | INT DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### Coluna nova em `ai_agents`

```sql
ALTER TABLE ai_agents ADD COLUMN prompt_methods TEXT[] DEFAULT '{}';
```

### RLS

- Leitura: todos os usuarios autenticados
- Escrita: somente role = 'admin' (via `user_roles`)

### Migracao de agentes existentes

Agentes criados antes do AI Builder terao `prompt_methods = '{}'` (array vazio). O `agent-executor` deve tratar isso graciosamente: se `prompt_methods` esta vazio, nao injeta nenhum template de metodo — o agente funciona exatamente como antes. Nenhuma migracao destrutiva necessaria.

### Seeds

9 metodos pre-cadastrados:
1. Chain of Thought (support)
2. Decision Tree (triage)
3. PASA (financial)
4. AIDA (sales, sdr)
5. ReAct (copilot)
6. Structured Output (analytics)
7. Emotion Method (customer_success, support)
8. Self-Reflection (support, financial, sales)
9. Few-Shot Examples (support, financial, sales, triage)

---

## 6. Edge Functions

### CRIAR: `ai-builder`

Nova edge function que substitui `skill-agent-creator`.

**Aceita:**
```json
{
  "mode": "agent" | "skill",
  "messages": [{ "role": "user|assistant", "content": "..." }]
}
```

**Retorna:**
```json
// Pergunta (fluxo em andamento)
{
  "type": "question",
  "message": "Qual o objetivo principal?",
  "phase": 1,
  "phase_label": "Identidade",
  "partial_config": { "name": "...", "specialty": "..." }
}

// Config final (pronto para criar)
{
  "type": "config",
  "config": { /* agent ou skill completo */ },
  "message": "Agente configurado!"
}
```

**Resposta de erro:**
```json
{ "type": "error", "message": "Descricao do erro", "code": "PARSE_ERROR|LLM_ERROR|VALIDATION_ERROR" }
```

**partial_config por fase (agente):**
- Apos Fase 1: `name`, `specialty`, `description`, `tone`
- Apos Fase 2: + `support_config.greeting`, `support_config.escalationTriggers`, `support_config.escalationMessage`
- Apos Fase 3: + `rag_enabled`, `rag_top_k`, `support_config.diagnosticQuestions`, `support_config.commonIssues`
- Apos Fase 4: + `prompt_methods`, `system_prompt` (completo), `temperature`, `max_tokens`, `confidence_threshold`

**Modelo LLM:** Gemini 2.5 Pro (via OpenRouter) — upgrade intencional do Gemini 2.0 Flash usado no resto do sistema. Justificativa: criacao de agentes exige raciocinio mais sofisticado, custo por chamada aceitavel pois e operacao rara (admin cria agentes esporadicamente).

**Diferencias do antigo `skill-agent-creator`:**
- Fluxo profundo (10-15 perguntas vs 2)
- Suporta modo `skill` alem de `agent`
- Retorna `phase` e `partial_config` para UI progressiva
- Busca metodos disponiveis de `ai_prompt_methods`
- Gera system prompt com metodo selecionado integrado
- 2 tools: `generate_agent` + `generate_skill`

### MODIFICAR

- `agent-executor` — adicionar leitura de `prompt_methods` da tabela `ai_prompt_methods` e injecao dos templates no system prompt. Hoje ja le skills (linhas 234-270), precisa adicionar logica similar para metodos.

### MANTER (sem mudanca)

- `generate-agent-system-prompt` — pode ser reutilizada pelo ai-builder

### DEPRECAR

- `skill-agent-creator` — substituida por `ai-builder` (existe em `supabase/functions/skill-agent-creator/index.ts`)

### MANTER (escopo separado)

- `agent-configurator` — MANTER para webhooks e automacoes. REMOVER capacidade de criar agentes (redirecionar para `/ai-builder`). A pagina `/ai-configurator` continua ativa para outros contextos.

---

## 7. Componentes React

### CRIAR

| Componente | Descricao |
|-----------|-----------|
| `src/pages/AIBuilder.tsx` | Pagina principal com tabs |
| `src/components/ai-builder/BuilderChat.tsx` | Painel esquerdo — chat + fases |
| `src/components/ai-builder/BuilderPreview.tsx` | Painel direito — preview em tempo real |
| `src/components/ai-builder/AgentPreviewCard.tsx` | Card de preview do agente |
| `src/components/ai-builder/SkillPreviewCard.tsx` | Card de preview da skill |
| `src/components/ai-builder/MethodSelector.tsx` | Dropdown + checkboxes de metodos |
| `src/components/ai-builder/PhaseIndicator.tsx` | Barra de progresso por fases |
| `src/components/ai-builder/TemplatesGrid.tsx` | Grid de templates pre-configurados (hardcoded, absorve dados do antigo `AgentTemplates.tsx`: triage, support, financial, sales, copilot, customer_success, onboarding, feedback, retention) |
| `src/components/ai-builder/ChatBubble.tsx` | Bolha de mensagem (reutilizar estilo GMS) |
| `src/hooks/usePromptMethods.ts` | Hook para buscar metodos do banco |
| `src/hooks/useAIBuilder.ts` | Hook principal — estado do chat, envio, config parcial |

### DELETAR

| Arquivo | Motivo |
|---------|--------|
| `src/pages/AIConfig.tsx` | Duplica criacao — absorvido |
| `src/pages/AIConfigGuide.tsx` | Tutorial — absorvido |
| `src/pages/HumanAgents.tsx` | Codigo morto (cleanup nao relacionado ao AI Builder, mas aproveitar a mesma PR) |
| `src/components/agents/SkillAgentDialog.tsx` | Absorvido pelo AI Builder |
| `src/components/agents/AgentSupportEditor.tsx` | Duplica tabs do AgentFormDialog |
| `src/components/agents/AgentAIConfigurator.tsx` | Absorvido |
| `src/components/agents/AgentTemplates.tsx` | Absorvido pela tab Templates |

### MANTER

| Arquivo | Motivo |
|---------|--------|
| `src/components/agents/AgentFormDialog.tsx` + 15 tabs | Editor completo |
| `src/components/agents/AgentListCard.tsx` | Card de listagem |
| `src/components/agents/AgentFlowPipeline.tsx` | Visualizacao do orquestrador |
| `src/components/agents/skills/SkillsManager.tsx` | CRUD de skills (vai funcionar com tabelas novas) |
| `src/components/agents/skills/SkillCard.tsx` | Card de skill |
| `src/components/agents/skills/SkillFormDialog.tsx` | Form de skill |
| `src/components/agents/form-tabs/AgentSkills.tsx` | Tab de skills no form do agente |
| `src/hooks/useAgents.ts` | CRUD de agentes |
| `src/hooks/useAgentSkills.ts` | CRUD de skills + assignments |

---

## 8. Rotas — Antes e Depois

### REMOVER do App.tsx

```
/ai-config        → AIConfig
/ai-config-guide  → AIConfigGuide
/human-agents     → redirect
```

### ADICIONAR

```
/ai-builder       → AIBuilder (AdminRoute)
```

### Sidebar — Atualizar

```
Secao "Agentes":
  /agents      → Meus Agentes
  /ai-builder  → AI Builder
  /ai-settings → Modelos IA
```

### RESULTADO FINAL

```
ANTES: 8 rotas, 3 caminhos de criacao, 27 arquivos
DEPOIS: 4 rotas, 1 caminho unificado, ~20 arquivos
```

---

## 9. Integracao com agent-executor

O `agent-executor` ja injeta skills no prompt (linhas 234-270 do index.ts). Com as tabelas criadas, o fluxo completo sera:

```
AI Builder cria agente → salva em ai_agents (com prompt_methods)
AI Builder cria skill  → salva em ai_agent_skills
AI Builder atribui skills → salva em ai_agent_skill_assignments

agent-executor recebe mensagem:
  1. Busca agente (ai_agents)
  2. Busca skills ativas (ai_agent_skill_assignments + ai_agent_skills)
  3. Busca metodos (ai_prompt_methods via agent.prompt_methods)
  4. Monta system_prompt = agent.system_prompt + skills + methods + RAG
  5. Envia para LLM
```

---

## 10. Fora de Escopo (futuro)

- Upload de arquivos no AI Builder (PDF, imagens) — absorver do AIConfigurator depois
- Versionamento de system prompts (A/B testing)
- Marketplace de skills compartilhadas
- Importacao/exportacao de agentes
- Skill do Claude Code para criacao via terminal
