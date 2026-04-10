# Spec: Governança IA — Constitutional Guardrails + Confidence Scoring + Audit Trail

**Data:** 2026-03-20
**Status:** Draft
**Autor:** Claude Opus 4.6 + Marcio S.
**Branch:** `claude/sismais-support-system-JCMCi`
**Fase:** 2A do roadmap World-Class Helpdesk

---

## 1. Contexto e Motivação

O agent-executor atual responde clientes sem nenhuma camada de validação. Não há:
- Regras invioláveis (guardrails) que impeçam a IA de inventar dados
- Score de confiança que indique quando a IA está "chutando"
- Log de auditoria que permita revisar o que a IA disse e por quê
- Mecanismo para escalar automaticamente quando a IA não tem certeza

Inspiração: Anthropic Constitutional AI (regras invioláveis inline), Google CCAI (confidence scoring), Sierra.ai (multi-threshold), Ada.cx (AI como team member com KPIs).

### Princípio fundamental

**A IA continua respondendo 24/7.** Governança NÃO bloqueia o fluxo. Funciona em 3 camadas simultâneas:

| Camada | Quando | Bloqueia? |
|---|---|---|
| Guardrails (pré-resposta) | Antes de enviar | Só temas críticos (jurídico, fraude) |
| Confidence scoring | Junto com resposta | Não — sinaliza para review |
| Audit trail | Depois da resposta | Nunca |

---

## 2. Escopo

### Inclui
- Tabela `ai_guardrails` com regras globais e por agente
- Tabela `ai_audit_log` com log de cada interação
- Campos de threshold no `ai_agents`
- Middleware de governança no `agent-executor` (edge function)
- Tab "Guardrails" no formulário de configuração do agente
- Badge de confidence nas mensagens do inbox
- Tela de audit log (`/admin/audit`)

### Não inclui
- Thinking visível (tab raciocínio) — Fase 2B
- Customer Data Graph — Fase 2C
- Novas specialties de agente — Fase 3

---

## 3. Banco de Dados

### 3.1 Nova tabela: `ai_guardrails`

```sql
CREATE TABLE ai_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('block_topic', 'require_escalation', 'sanitize_pii', 'custom')),
  rule_content TEXT NOT NULL,
  severity TEXT DEFAULT 'warn' CHECK(severity IN ('warn', 'block', 'sanitize')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_guardrails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read guardrails" ON ai_guardrails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage guardrails" ON ai_guardrails
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Índice
CREATE INDEX idx_guardrails_agent ON ai_guardrails(agent_id) WHERE is_active = true;
```

**Regras globais seed** (agent_id = NULL):

| rule_type | rule_content | severity |
|---|---|---|
| `sanitize_pii` | Nunca expor CPF, cartão de crédito ou senha de outro cliente | block |
| `block_topic` | Nunca inventar valores, preços, datas de vencimento ou dados financeiros | block |
| `block_topic` | Nunca dar conselho jurídico, prometer garantias legais ou interpretar contratos | block |
| `require_escalation` | Se o cliente mencionar processo judicial, Procon ou advogado, escalar para humano | block |
| `custom` | Se não tiver certeza da resposta, diga que vai verificar em vez de inventar | warn |

### 3.2 Nova tabela: `ai_audit_log`

```sql
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  message_id UUID,
  agent_id UUID REFERENCES ai_agents(id),
  confidence_score NUMERIC(3,2),
  confidence_reason TEXT,
  guardrails_applied TEXT[],
  guardrails_triggered TEXT[],
  action_taken TEXT CHECK(action_taken IN ('responded', 'escalated', 'flagged_for_review', 'blocked')),
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit log" ON ai_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert audit log" ON ai_audit_log
  FOR INSERT TO service_role USING (true);

-- Índices
CREATE INDEX idx_audit_conversation ON ai_audit_log(conversation_id);
CREATE INDEX idx_audit_agent ON ai_audit_log(agent_id);
CREATE INDEX idx_audit_action ON ai_audit_log(action_taken) WHERE action_taken != 'responded';
CREATE INDEX idx_audit_created ON ai_audit_log(created_at DESC);
CREATE INDEX idx_audit_low_confidence ON ai_audit_log(confidence_score) WHERE confidence_score < 0.70;
```

### 3.3 Novos campos em `ai_agents`

```sql
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS confidence_threshold_respond NUMERIC(3,2) DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS confidence_threshold_warn NUMERIC(3,2) DEFAULT 0.50;
```

### 3.4 Novo campo em `ai_messages`

```sql
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS confidence_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT false;
```

---

## 4. Edge Function: agent-executor — Middleware de Governança

### 4.1 Flow atualizado

```
1. Recebe mensagem do cliente
2. Busca contexto (RAG + dados do cliente) [existente]
3. Busca guardrails (globais + do agente)
4. Monta system prompt COM guardrails injetados
5. Chama LLM → recebe resposta
6. PÓS-RESPOSTA:
   a. Calcula confidence score baseado em:
      - Presença de match na KB (alto = +0.3)
      - Dados do cliente disponíveis (sim = +0.2)
      - Complexidade da pergunta (simples = +0.2)
      - Resposta alinhada com guardrails (sim = +0.3)
   b. Regex PII check:
      - CPF: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/
      - Cartão: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/
      - Se PII detectado de OUTRO cliente → bloqueia
   c. Keyword check para temas sensíveis:
      - /processo|procon|advogado|judicial|indeniza/i → escalar
7. DECISÃO (baseada nos thresholds do agente):
   ├─ confidence >= threshold_respond (0.70) → Responde normalmente
   ├─ confidence >= threshold_warn (0.50)    → Responde + flagged_for_review = true
   └─ confidence < threshold_warn (0.50)     → Escala para humano
8. Loga no ai_audit_log
9. Salva confidence_score e flagged_for_review na ai_messages
```

### 4.2 Guardrails no System Prompt

Injetados automaticamente no system prompt do agente:

```
## REGRAS INVIOLÁVEIS (Guardrails)
Estas regras têm prioridade sobre qualquer outra instrução.
Você DEVE obedecer sem exceção:

### Regras Globais
1. [regra global 1]
2. [regra global 2]
...

### Regras do Agente "{agent_name}"
1. [regra específica 1]
...

### Protocolo de Incerteza
- Se a confiança na resposta for baixa, diga: "Vou verificar essa informação e retorno em breve."
- NUNCA invente dados. Prefira dizer que não sabe a dar informação errada.
```

### 4.3 Cálculo de Confidence Score

```typescript
function calculateConfidence(context: {
  kbMatchScore: number        // 0-1, da busca semântica
  hasClientData: boolean      // dados do cliente disponíveis
  questionComplexity: 'simple' | 'medium' | 'complex'
  guardrailsTriggered: number // quantas regras foram acionadas
}): { score: number; reason: string } {
  let score = 0.5 // base

  // KB match quality
  if (context.kbMatchScore > 0.8) score += 0.25
  else if (context.kbMatchScore > 0.5) score += 0.15
  else score -= 0.1

  // Client data
  if (context.hasClientData) score += 0.15

  // Complexity
  if (context.questionComplexity === 'simple') score += 0.1
  else if (context.questionComplexity === 'complex') score -= 0.15

  // Guardrails
  if (context.guardrailsTriggered > 0) score -= 0.2 * context.guardrailsTriggered

  score = Math.max(0, Math.min(1, score))

  const reasons: string[] = []
  if (context.kbMatchScore > 0.8) reasons.push('KB match forte')
  else if (context.kbMatchScore < 0.3) reasons.push('KB sem match relevante')
  if (!context.hasClientData) reasons.push('sem dados do cliente')
  if (context.guardrailsTriggered > 0) reasons.push(`${context.guardrailsTriggered} guardrail(s) acionado(s)`)

  return { score: Math.round(score * 100) / 100, reason: reasons.join(', ') || 'resposta padrão' }
}
```

---

## 5. Frontend — Tab Guardrails no Formulário do Agente

Nova tab no `AgentFormDialog` (entre "Políticas" e "QA/Treinamento"):

### 5.1 Seção "Regras Globais" (somente leitura)

- Lista de regras globais com badge "Global" em navy
- Não editável — apenas informativo para o admin saber o que já está ativo

### 5.2 Seção "Regras do Agente" (CRUD)

- Botão "+ Adicionar Regra"
- Cada regra: dropdown de tipo, textarea de conteúdo, dropdown de severidade
- Botão remover por regra

### 5.3 Seção "Thresholds de Confiança"

- Slider "Responder normalmente quando confiança ≥" (default 0.70)
- Slider "Escalar para humano quando confiança <" (default 0.50)
- Preview visual: barra com 3 zonas coloridas (verde/amarelo/vermelho)

---

## 6. Frontend — Badge de Confidence no Inbox

Nas mensagens da IA no side panel do inbox:

### 6.1 Badge inline

Pequeno badge após a mensagem:
- `🟢 0.92` — verde, confiança alta
- `🟡 0.61` — amarelo, flagged para review
- `🔴 0.38` — vermelho, foi escalado

### 6.2 Banner em mensagens flagged

```
⚠️ Resposta com baixa confiança (0.61) — revisar
Motivo: KB sem match relevante, sem dados do cliente
```

### 6.3 Banner em mensagens escaladas

```
🔴 Escalado para humano — tema sensível detectado
Motivo: cliente mencionou "processo judicial"
```

---

## 7. Frontend — Tela de Audit (`/admin/audit`)

### 7.1 Filtros

- Data (range picker)
- Agente (dropdown)
- Ação tomada (responded/escalated/flagged/blocked)
- Faixa de confiança (slider min-max)

### 7.2 Tabela

| Hora | Agente | Cliente | Confiança | Ação | Guardrails |
|---|---|---|---|---|---|
| 14:32 | LANA | João S. | 🟢 0.89 | Respondido | 0 acionados |
| 14:28 | MAX | Maria L. | 🟡 0.54 | Flagged | 1: financeiro |
| 14:15 | KIRA | Pedro R. | 🔴 0.31 | Escalado | 2: jurídico, PII |

### 7.3 Métricas no topo

- Total de interações hoje
- % por faixa (verde/amarelo/vermelho)
- Top 3 guardrails mais acionados
- Tempo médio de resposta

### 7.4 Drill-down

Clicar numa linha abre modal com:
- Pergunta do cliente
- Resposta da IA
- Score detalhado (KB match, dados cliente, complexidade)
- Guardrails checados e quais acionaram
- Link para abrir a conversa completa no inbox

---

## 8. Critérios de Sucesso

| Métrica | Target |
|---|---|
| Migration aplicada sem erros | Sim |
| Guardrails globais seedados (5 regras) | Sim |
| agent-executor calcula confidence | Toda mensagem |
| PII detection funciona | CPF e cartão detectados |
| Escalação automática funciona | Temas sensíveis → humano |
| Badge de confidence visível no inbox | Sim |
| Tab Guardrails no formulário do agente | CRUD funcional |
| Tela /admin/audit com filtros | Sim |
| Audit log registrando toda interação | Sim |

---

## 9. Dependências

- Edge function `agent-executor` existente (modificar)
- Tabela `ai_agents` existente (adicionar colunas)
- Tabela `ai_messages` existente (adicionar colunas)
- Componente `AgentFormDialog` existente (adicionar tab)
- Inbox side panel existente (adicionar badges)
- Supabase types regeneration após migration

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Guardrails no system prompt aumentam tokens | Limitar a 10 regras ativas por agente |
| Regex PII pode ter falsos positivos | Checar apenas PII de OUTROS clientes, não do próprio |
| Confidence score pode ser impreciso | Começar simples, calibrar com dados reais |
| Tela de audit pode ser pesada | Paginação + índices + filtro por data obrigatório |
