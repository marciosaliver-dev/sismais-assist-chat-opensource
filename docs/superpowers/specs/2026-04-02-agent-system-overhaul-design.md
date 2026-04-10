# Spec: Overhaul do Sistema de Agentes IA — Sismais Helpdesk

**Data:** 2026-04-02
**Autor:** Márcio Saraiva + Claude
**Branch:** `claude/sismais-support-system-JCMCi`
**Status:** Draft

---

## 1. Contexto e Problemas Identificados

### Diagnóstico baseado em dados (últimas 30 conversas - 2026-04-01)
- **~80% das conversas com `ai_messages_count = 0`** — IA não responde clientes
- **Todas com `priority_score = 50`** — classificação de prioridade não funciona
- **Mensagem de "alta demanda" dispara sempre** ao escalar para humano, sem verificar fila real
- **IA não retoma** quando humano não responde após escalação
- **Resumos genéricos** sem sugestões de resposta ou detecção de insatisfação
- **Agentes inativos** (KIRA, KITANA, LANA) ainda recebem conversas

### Agentes ativos no sistema
| Agente | Specialty | Priority | Modelo | Status |
|--------|-----------|----------|--------|--------|
| Lino | support (Mais Simples) | 90 | gemini-3.1-flash-lite-preview | Ativo |
| MAX | support (MaxPro) | 20 | gemini-3.1-flash-lite-preview | Ativo |
| Maya | onboarding | 3 | gemini-2.0-flash-001 | Ativo |
| Renan | retention | 4 | gemini-2.0-flash-001 | Ativo |
| AXEL | copilot (interno) | 50 | grok-code-fast-1 | Ativo |
| ORION | copilot (interno) | 50 | gemini-2.0-flash-001 | Ativo |
| LANA | triage | 0 | gemini-3.1-flash-lite-preview | **Inativo** |
| KIRA | financial | 30 | gemini-2.0-flash-001 | **Inativo** |
| KITANA | sdr | 40 | gemini-2.0-flash-001 | **Inativo** |

---

## 2. Decisões Arquiteturais

### 2.1 Sem agente de triagem (LANA permanece desativada)
O orchestrator já faz triagem via `message-analyzer` (sentiment, urgency, intent). Um agente de triagem separado adiciona latência (+2-3s) e cria ponto único de falha. As habilidades de LANA (saudação, identificação, coleta de CNPJ) serão absorvidas pelos prompts dos agentes especialistas.

### 2.2 Modelos via OpenRouter — cadeia de fallback
O modelo `gemini-2.0-flash-001` será descontinuado. Cadeia de fallback:

| Prioridade | Modelo OpenRouter | Uso |
|------------|-------------------|-----|
| 1 (primário) | `google/gemini-2.5-flash-preview` | Agentes de atendimento (Lino, MAX, Maya, Renan) |
| 2 (fallback) | `google/gemini-2.0-flash-lite-001` | Se primário falha |
| 3 (emergency) | `anthropic/claude-haiku-4-5-20251001` | Se Google inteiro fora |

Para copilots internos (AXEL, ORION):
| Prioridade | Modelo | Uso |
|------------|--------|-----|
| 1 | `google/gemini-2.5-flash-preview` | Análise e briefings |
| 2 | `anthropic/claude-haiku-4-5-20251001` | Fallback |

### 2.3 Monitoramento obrigatório de toda ação
Toda chamada de API, toda decisão do orchestrator, toda execução de agente DEVE ser registrada em um painel de monitoramento. Erros geram notificação em tempo real.

---

## 3. Mudanças no Pipeline

### 3.1 Fix do silêncio da IA (agent-executor)

**Problema:** Pipeline falha silenciosamente e cliente fica sem resposta.

**Solução — 3 camadas de proteção:**

```
Camada 1: Retry com fallback de modelo
  tentativa 1 → modelo primário
  tentativa 2 → modelo fallback (1s delay)
  tentativa 3 → modelo emergency (2s delay)

Camada 2: Dead letter handler
  Se todas as 3 tentativas falham:
  → Enviar ao cliente: "Recebi sua mensagem! Estou verificando internamente e já retorno."
  → Registrar no monitoring como CRITICAL
  → Enviar notificação ao time

Camada 3: Health check pré-chamada
  Antes de chamar LLM, verificar se modelo respondeu nos últimos 5 min
  Se não → ir direto para fallback
```

**Arquivo:** `supabase/functions/agent-executor/index.ts`

**Mudanças:**
- Extrair chamada LLM para função `callLLMWithFallback(models[], prompt, options)`
- Adicionar try/catch com retry em cada modelo da cadeia
- Se tudo falha → chamar `sendDeadLetterResponse(conversationId, customerPhone)`
- Logar CADA tentativa no painel de monitoramento

### 3.2 Fix da mensagem de alta demanda (process-incoming-message)

**Problema:** Mensagem "estamos com alta demanda" dispara sempre que escala para humano.

**Solução — verificação real antes de enviar:**

```sql
-- Fila REAL: apenas aguardando atendimento humano
SELECT COUNT(*) as queue_count
FROM ai_conversations
WHERE handler_type = 'human'
  AND status = 'aguardando'
  AND is_discarded = false;

-- Agentes disponíveis
SELECT COUNT(*) as available_agents
FROM human_agents
WHERE is_online = true
  AND is_active = true
  AND current_conversations_count < max_concurrent_conversations;
```

**Thresholds de mensagem:**

| Fila | Agentes disponíveis | Mensagem |
|------|---------------------|----------|
| 0-2 | >= 1 | "Você será atendido em instantes! Enquanto isso, posso ajudar?" |
| 3-5 | >= 1 | "Nosso time já está ciente. Tempo estimado: ~X minutos." |
| 6+ | >= 1 | "Estamos com volume acima do normal. Tempo estimado: ~X minutos." |
| qualquer | 0 | "Nosso time está sendo acionado. Enquanto isso, continue comigo que vou te ajudando!" |

**Cálculo do tempo:** `ceil(queue_count / available_agents) * avg_service_minutes`

**Arquivo:** `supabase/functions/process-incoming-message/index.ts` — seção de escalação

### 3.3 Retomada da IA após humano ausente

**Problema:** Quando escala para humano e ninguém responde, o cliente fica preso.

**Solução — escalonamento progressivo:**

| Tempo sem resposta humana | Ação |
|---------------------------|------|
| 3 min | IA envia: "Nosso time já recebeu seu chamado. Enquanto aguardamos, posso te ajudar com algo?" |
| 7 min | IA envia: "Vou continuar te auxiliando enquanto nosso time se organiza." + `handler_type` volta para `'ai'` |
| Fora do horário comercial | IA assume imediatamente, sem esperar humano |

**Arquivo:** `supabase/functions/check-inactive-conversations/index.ts`

**Mudanças:**
- Reduzir timeout de inatividade de 10min para 3/7min (escalonado)
- Na retomada, IA recebe briefing do AXEL (copilot) sobre contexto da conversa
- Logar retomada no monitoring

### 3.4 Prioridade dinâmica (ticket-priority-classifier)

**Problema:** Todas as conversas ficam com `priority_score = 50` (medium).

**Solução — integrar classificador no pipeline principal:**

```
process-incoming-message
  → message-analyzer (já existe)
  → ticket-priority-classifier (NOVO no pipeline)
  → orchestrator
  → agent-executor
```

**Regras de auto-escalação:**
- `sentiment = 'negative'` por 2+ mensagens consecutivas → `priority = 'high'` (score 75)
- `urgency = 'critical'` → `priority = 'critical'` (score 90)
- Cliente com `churn_risk = 'high'` → `priority += 20`
- Cliente inadimplente + `intent = 'complaint'` → `priority = 'high'`
- Tempo na fila > SLA de first response → auto-escalate priority

**Tag visual:** Conversas com cliente insatisfeito recebem badge `🔴 Insatisfeito` na fila + posição prioritária.

---

## 4. Painel de Monitoramento (NOVO)

### 4.1 Tabela `ai_action_logs`

```sql
CREATE TABLE ai_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  conversation_id UUID REFERENCES ai_conversations(id),
  action_type TEXT NOT NULL,
    -- 'llm_call', 'tool_call', 'orchestrator_decision', 'escalation',
    -- 'model_fallback', 'dead_letter', 'priority_change', 'automation_trigger'
  agent_id UUID REFERENCES ai_agents(id),
  status TEXT NOT NULL, -- 'success', 'error', 'timeout', 'fallback'
  model TEXT,
  duration_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd DECIMAL(10,6),
  error_message TEXT,
  details JSONB, -- payload flexível por tipo de ação
  notification_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_action_logs_status ON ai_action_logs(status, created_at DESC);
CREATE INDEX idx_action_logs_conversation ON ai_action_logs(conversation_id, created_at);
CREATE INDEX idx_action_logs_errors ON ai_action_logs(status, created_at DESC) WHERE status = 'error';
```

### 4.2 O que registrar

| Ação | Quando | Detalhes no JSONB |
|------|--------|-------------------|
| `llm_call` | Toda chamada ao OpenRouter | modelo, tokens, latência, response_status |
| `llm_fallback` | Quando primário falha e usa fallback | modelo_original, modelo_fallback, erro_original |
| `tool_call` | Agente usa ferramenta (customer_search, etc.) | tool_name, input, output_summary |
| `orchestrator_decision` | Orchestrator decide rota | agent_chosen, reason, analysis_result |
| `escalation` | Escala para humano | reason, queue_size, agents_online |
| `dead_letter` | Pipeline falha completamente | todos os erros, tentativas |
| `priority_change` | Prioridade muda | before, after, reason, source |
| `automation_trigger` | Automação dispara | automation_name, conditions_met |
| `human_takeover` | Humano assume | agent_id, response_time |
| `ai_resume` | IA retoma após humano ausente | timeout_minutes, reason |

### 4.3 Notificações de erro

**Quando notificar:**
- `status = 'error'` em qualquer ação
- `dead_letter` (pipeline falhou completamente) — CRITICAL
- `llm_fallback` (modelo primário caiu) — WARNING
- 3+ erros do mesmo tipo em 5 minutos — ALERT

**Como notificar:**
- Inserir em `ai_action_logs` com `notification_sent = false`
- Frontend faz polling ou Realtime subscription em logs com `status = 'error'`
- Badge no header do sistema: 🔴 com contador de erros não-lidos
- Som/vibração para erros CRITICAL

### 4.4 Tela de Monitoramento (frontend)

Nova rota: `/monitoring` ou aba em `/dashboard`

**Componentes:**
- **Timeline de eventos** — feed em tempo real de ações dos agentes
- **Indicadores de saúde** — status de cada modelo (verde/amarelo/vermelho)
- **Métricas** — taxa de sucesso, latência média, custo por conversa
- **Filtros** — por agente, por tipo de ação, por status, por período
- **Alertas ativos** — erros não resolvidos com destaque

---

## 5. CTA de Feedback de Respostas (NOVO)

### 5.1 Funcionalidade

Na tela de atendimento (inbox/conversa), cada mensagem do agente IA terá um botão discreto para o agente humano marcar como **resposta incorreta** e fornecer a correta.

### 5.2 Quem pode usar
- **Líderes** (role = 'leader') e **Admins** (role = 'admin') — podem marcar e corrigir
- **Agentes** (role = 'agent') — veem o botão mas não podem interagir (ou botão oculto)

### 5.3 Fluxo de UX

```
Mensagem do agente IA no chat
  → Hover revela ícone de "polegar para baixo" 👎
  → Click abre popover/modal:
    - "O que estava errado nesta resposta?"
      [ ] Informação incorreta
      [ ] Tom inadequado
      [ ] Não respondeu a pergunta
      [ ] Alucinação (inventou dados)
      [ ] Outro
    - "Resposta correta:" [textarea]
    - [Salvar correção]
```

### 5.4 Tabela `ai_response_corrections`

```sql
CREATE TABLE ai_response_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  message_id UUID NOT NULL REFERENCES ai_messages(id),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id),
  agent_id UUID REFERENCES ai_agents(id),
  corrected_by UUID NOT NULL REFERENCES auth.users(id),
  error_type TEXT NOT NULL,
    -- 'incorrect_info', 'wrong_tone', 'missed_question', 'hallucination', 'other'
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  notes TEXT,
  applied_to_training BOOLEAN DEFAULT FALSE
);
```

### 5.5 Uso dos dados de correção
- Correções alimentam o `learning-loop` para melhorar prompts
- Dashboard em `/agents` mostra taxa de correção por agente
- Padrões recorrentes de erro geram sugestões automáticas de ajuste no prompt
- Correções com `error_type = 'hallucination'` geram alerta para revisar guardrails

---

## 6. Prompts dos Agentes — Diretrizes

### 6.1 Princípio central
> Cada agente IA deve ter a capacidade de um agente de suporte sênior com 20+ anos de experiência na empresa, com conhecimento profundo sobre sua especialidade e os produtos Sismais (Mais Simples e MaxPro).

### 6.2 Personalidade obrigatória (todos os agentes)

```
## REGRAS DE CORDIALIDADE (INVIOLÁVEIS)

1. PRIMEIRA MENSAGEM — sempre cumprimente pelo nome (se disponível), 
   pergunte como pode ajudar, e demonstre genuíno interesse.
   Exemplo: "Olá, [Nome]! Que bom falar com você! 😊 Sou o [Agente], 
   como posso te ajudar hoje?"

2. DURANTE O ATENDIMENTO — seja paciente, nunca demonstre irritação,
   reconheça frustrações do cliente, use linguagem positiva e empática.

3. ENCERRAMENTO — sempre agradeça, pergunte se há mais algo, 
   e deseje algo positivo.
   Exemplo: "Foi um prazer te ajudar, [Nome]! Se precisar de qualquer 
   coisa, é só me chamar. Tenha um ótimo dia! 😊"

4. NUNCA deixe o cliente sem resposta. Se não souber a resposta,
   diga que vai verificar. Se o sistema falhar, avise que está
   investigando.

5. ADAPTE o tom ao humor do cliente — se frustrado, reconheça primeiro.
   Se animado, compartilhe o entusiasmo.
```

### 6.3 Capacidades de agente sênior (todos os agentes)

```
## EXPERTISE DE AGENTE SÊNIOR

Você atende como se tivesse 20+ anos de experiência na Sismais Tecnologia:

1. CONHECIMENTO PROFUNDO — conhece cada funcionalidade, atalho e 
   limitação dos produtos. Quando a KB não tem a resposta, usa seu 
   conhecimento acumulado para guiar o cliente.

2. ANÁLISE DE HISTÓRICO — SEMPRE revise o histórico da conversa e 
   tickets anteriores antes de responder. Não peça informações que o 
   cliente já forneceu.

3. DIAGNÓSTICO PROATIVO — não espere o cliente descrever tudo. 
   Faça perguntas diagnósticas inteligentes baseadas nos sintomas.
   Antecipe problemas relacionados.

4. RESOLUÇÃO NA PRIMEIRA INTERAÇÃO — priorize resolver sem escalar.
   Escale apenas quando realmente necessário (bug confirmado, acesso 
   a sistema que não tem, decisão financeira/jurídica).

5. FOLLOW-UP — se o problema é complexo, informe os próximos passos 
   claros e prazos realistas.

6. EMPATIA GENUÍNA — entenda que o cliente pode estar perdendo dinheiro 
   ou tempo. Trate com a urgência apropriada.
```

### 6.4 Prompt específico — Lino (Suporte Mais Simples, priority 90)

Ajustes no prompt atual:
- Adicionar seção de cordialidade obrigatória (6.2)
- Adicionar capacidades sênior (6.3)
- Adicionar: "Na primeira mensagem, se o cliente não estiver identificado, peça CNPJ ou nome da empresa de forma natural e amigável"
- Adicionar: "Consulte SEMPRE a base de conhecimento antes de responder questões técnicas"
- Adicionar: "Se detectar frustração, reconheça ANTES de propor solução"
- Modelo: `google/gemini-2.5-flash-preview`

### 6.5 Prompt específico — MAX (Suporte MaxPro, priority 20→80)

Ajustes:
- Aumentar priority de 20 para **80** (MaxPro é produto enterprise, merece prioridade alta)
- Mesmas adições de cordialidade e expertise sênior
- Adicionar conhecimento específico MaxPro (ERP, NF-e, fiscal)
- Modelo: `google/gemini-2.5-flash-preview`

### 6.6 Prompt específico — Maya (Onboarding, priority 3→60)

Ajustes:
- Aumentar priority de 3 para **60** (onboarding é momento crítico)
- Manter personalidade animada e didática
- Adicionar: "Guie o cliente passo a passo, nunca presuma conhecimento prévio"
- Adicionar checklist de onboarding no prompt
- Modelo: `google/gemini-2.5-flash-preview`

### 6.7 Prompt específico — Renan (Retenção, priority 4→85)

Ajustes:
- Aumentar priority de 4 para **85** (retenção é a maior prioridade de negócio)
- Adicionar: "Ouça primeiro, entenda o motivo REAL do cancelamento antes de oferecer qualquer coisa"
- Adicionar arsenal de retenção: descontos, upgrades, suporte dedicado
- Modelo: `google/gemini-2.5-flash-preview`

### 6.8 Agentes inativos — decisão

| Agente | Decisão | Motivo |
|--------|---------|--------|
| LANA (triage) | Manter inativa | Orchestrator faz triagem |
| KIRA (financial) | **Reativar** com novo prompt | Financeiro é essencial — cobranças, 2ª via, Asaas |
| KITANA (sdr) | Manter inativa por ora | Sem fluxo de vendas ativo |

KIRA reativada com:
- Priority: **70**
- Modelo: `google/gemini-2.5-flash-preview`
- Mesma cordialidade + expertise sênior
- Foco: cobranças delicadas, 2ª via, negociação de pagamento

---

## 7. Resumo Inteligente (summarize-conversation)

### 7.1 Output enriquecido

O `summarize-conversation` passará a gerar:

```json
{
  "summary": "Resumo textual de 2-4 frases",
  "satisfaction_score": 0.7,        // -1.0 a 1.0
  "suggested_responses": [
    "Entendo sua frustração. Vou verificar isso agora mesmo para você.",
    "Já identifiquei o problema. Vou te guiar na solução passo a passo.",
    "Vou escalar isso para nossa equipe técnica com prioridade."
  ],
  "next_steps": "Verificar configuração de NF-e no módulo fiscal",
  "urgency_flag": false,
  "customer_emotion": "neutral"     // frustrated, angry, neutral, satisfied, happy
}
```

### 7.2 Auto-escalação de prioridade por insatisfação

```
Se satisfaction_score < -0.3 por 2+ mensagens consecutivas:
  → UPDATE ai_conversations SET
      priority = 'high',
      priority_score = 75,
      tags = array_append(tags, 'insatisfeito')
  → Logar em ai_action_logs (priority_change)
  → Badge vermelho na fila

Se satisfaction_score < -0.7 (cliente muito irritado):
  → priority = 'critical', priority_score = 90
  → Notificação para supervisor
```

### 7.3 Integração com Análise em Tempo Real

O painel de "Análise em Tempo Real" já existente no chat será alimentado com os novos campos:
- **Interpretação** ← `customer_emotion` + `satisfaction_score`
- **Sugestão** ← `suggested_responses` (3 opções clicáveis)
- **Insight** ← `next_steps` + contexto de histórico

---

## 8. Automações — Correções

### 8.1 Automações ativas que precisam de ajuste

| Automação | Problema | Correção |
|-----------|----------|----------|
| "Fora do Horário" | Mensagem genérica | IA assume atendimento + mensagem sobre horário |
| Queue notifications | Intervalo de 10min | Reduzir para 5min, mensagem contextual |

### 8.2 Nova automação: "Sem resposta da IA"

```
Trigger: conversation criada + 30 segundos sem ai_messages
Ação: 
  1. Retry do pipeline (chamar process-incoming-message novamente)
  2. Se falha de novo: enviar mensagem genérica amigável
  3. Logar como CRITICAL no monitoring
```

---

## 9. Referências ExpxAgents Marketplace

Squads consultadas para melhores práticas:
- **@thuliobittencourt/support-playbook-squad** — fluxos de triagem, escalação, SLAs, runbooks
- **@thuliobittencourt/support-templates-squad** — templates de comunicação, macros, scripts
- **@thuliobittencourt/support-analytics-squad** — métricas, KPIs, dashboards
- **@thuliobittencourt/support-knowledge-squad** — estrutura de KB por audiência

---

## 10. Escopo de Implementação

### Tasks de backend (Edge Functions)
1. Fix agent-executor: retry com fallback de modelo + dead letter handler
2. Fix process-incoming-message: verificação real de fila antes de mensagem de demanda
3. Fix check-inactive-conversations: retomada da IA em 3/7 min
4. Integrar ticket-priority-classifier no pipeline
5. Enriquecer summarize-conversation com sugestões e satisfaction_score
6. Criar tabela ai_action_logs + logging em todo pipeline
7. Criar tabela ai_response_corrections
8. Criar edge function para notificações de erro
9. Atualizar modelos de todos os agentes para gemini-2.5-flash-preview

### Tasks de frontend (React)
10. Painel de monitoramento (/monitoring ou aba em dashboard)
11. CTA de feedback de respostas (botão 👎 no chat, popover de correção)
12. Badge de prioridade/insatisfação na fila
13. Sugestões de resposta clicáveis na Análise em Tempo Real
14. Badge de alertas no header (erros não lidos)

### Tasks de dados (SQL/Supabase)
15. Migration: criar ai_action_logs
16. Migration: criar ai_response_corrections
17. Atualizar prompts dos agentes no banco (Lino, MAX, Maya, Renan, KIRA)
18. Atualizar priorities dos agentes
19. Reativar KIRA com novo prompt
20. Atualizar platform_ai_config (modelos, timeouts, thresholds)

---

## 11. Fora de Escopo

- Criação de novos agentes (KITANA SDR permanece inativa)
- Refactor completo do orchestrator (apenas ajustes pontuais)
- Novo sistema de filas (usamos o existente com melhorias)
- Dashboard de analytics completo (apenas monitoramento operacional)
- Integração com ExpxAgents SDK (apenas referência de melhores práticas)
