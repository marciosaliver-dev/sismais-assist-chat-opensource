# E07 — Arquitetura Conversacional: State Machines, Contexto e Re-engagement

**Data:** 2026-03-19
**Autor:** Arquiteto Conversacional (analise automatizada)
**Escopo:** Camada intra-conversa — como o agente conduz o dialogo apos selecionado pelo orchestrator

---

## 1. Diagnostico do Estado Atual

### 1.1 O Que Existe

| Componente | Status | Arquivo |
|---|---|---|
| Analise de mensagem (intent, sentiment, urgency) | Funcional | `message-analyzer/index.ts` |
| Roteamento para agente por LLM | Funcional | `orchestrator/index.ts` |
| Execucao do agente com RAG e tools | Funcional | `agent-executor/index.ts` |
| Re-engagement por inatividade (follow-ups) | Funcional | `check-inactive-conversations/index.ts` |
| Resumo de conversa (sliding window) | Funcional | `summarize-conversation/index.ts` |
| Deteccao de resolucao (`[RESOLVED]`) | Funcional | `agent-executor/index.ts:336-346` |
| Deteccao de escalacao (`[ESCALATE]`) | Funcional | `agent-executor/index.ts:330-339` |
| Bypass de orchestrator para continuacoes | Funcional | `orchestrator/index.ts:99-130` |

### 1.2 O Que Falta

| Lacuna | Impacto |
|---|---|
| **Sem state machine explicita** — conversa nao tem estados formais (saudacao, coleta, diagnostico, resolucao) | Agente nao sabe "em que ponto" da conversa esta; trata toda mensagem como independente |
| **Sem coleta estruturada de dados** — informacoes do cliente (nome, problema, urgencia) sao extraidas apenas pelo `message-analyzer` basico | Agente precisa fazer perguntas repetidas; perde dados ja informados |
| **Sem gestao de topicos** — se cliente muda de assunto no meio da conversa, nao ha deteccao | Respostas misturadas entre topicos diferentes |
| **Sem re-engagement para escalacoes humanas** — `check-inactive-conversations` so age em conversas `handler_type=ai` | Conversas escaladas para humano sem resposta ficam abandonadas indefinidamente (debito D8 do E16) |
| **Sem transicao suave entre agentes** — quando orchestrator troca agente, o novo nao recebe briefing | Cliente percebe descontinuidade |
| **Sem deteccao de satisfacao progressiva** — CSAT so no final, nao durante conversa | Oportunidade perdida de intervir antes da insatisfacao |

---

## 2. Mapa de Estados Conversacionais

### 2.1 State Machine Principal

```
                    ┌──────────────────┐
                    │   NOVA_CONVERSA   │
                    │ (mensagem inicial)│
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   SAUDACAO        │
                    │ Identificar cliente│
                    │ Confirmar contexto │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   COLETA_INFO     │◄─── loop: dados insuficientes
                    │ Qual o problema?  │
                    │ Dados necessarios │
                    └────────┬─────────┘
                             │ dados suficientes
                    ┌────────▼─────────┐
                    │   DIAGNOSTICO     │◄─── RAG + tools
                    │ Analisar problema │
                    │ Consultar KB      │
                    └────────┬─────────┘
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
        ┌──────────┐ ┌───────────┐ ┌───────────┐
        │ RESOLUCAO│ │ ESCALACAO │ │ AGUARDANDO│
        │ Solucao  │ │ Humano    │ │ CLIENTE   │
        │ aplicada │ │ necessario│ │ Info extra│
        └─────┬────┘ └─────┬─────┘ └─────┬─────┘
              │             │             │
              ▼             ▼             │
        ┌──────────┐ ┌───────────┐       │
        │ FEEDBACK │ │ HANDOFF   │       │
        │ Resolveu?│ │ Transferir│       │
        └─────┬────┘ └───────────┘       │
              │                           │
              ▼                           │
        ┌──────────┐                      │
        │FINALIZADO│◄─────────────────────┘ (timeout)
        │ CSAT     │
        └──────────┘
```

### 2.2 Definicao dos Estados

| Estado | Condicao de Entrada | Acoes do Agente | Transicoes |
|---|---|---|---|
| `NOVA_CONVERSA` | Primeira mensagem do cliente | Criar conversa, rodar message-analyzer | -> `SAUDACAO` |
| `SAUDACAO` | Sempre apos nova conversa | Cumprimentar, identificar cliente (auto-link ou perguntar), confirmar se e cliente recorrente | -> `COLETA_INFO` se problema novo; -> `DIAGNOSTICO` se problema claro na primeira msg |
| `COLETA_INFO` | Dados insuficientes para diagnostico | Perguntar: qual sistema? qual erro? desde quando? ja tentou algo? | -> `DIAGNOSTICO` quando dados suficientes; -> `COLETA_INFO` (loop) se faltam dados |
| `DIAGNOSTICO` | Dados suficientes coletados | Buscar RAG, executar tools, analisar | -> `RESOLUCAO` se encontrou solucao; -> `ESCALACAO` se confidence baixa ou fora de escopo; -> `AGUARDANDO_CLIENTE` se precisa de confirmacao |
| `RESOLUCAO` | Solucao identificada | Apresentar solucao passo a passo | -> `FEEDBACK` apos apresentar solucao |
| `FEEDBACK` | Solucao apresentada | Perguntar se resolveu | -> `FINALIZADO` se cliente confirma; -> `DIAGNOSTICO` se nao resolveu; -> `ESCALACAO` se cliente insatisfeito |
| `ESCALACAO` | Confidence baixa, pedido humano, ou insatisfacao | Informar cliente, transferir, enviar briefing | -> `HANDOFF` |
| `HANDOFF` | Escalacao confirmada | Gerar resumo, atribuir agente humano | Terminal (sai do controle da IA) |
| `AGUARDANDO_CLIENTE` | IA fez pergunta, aguarda resposta | Nenhuma (aguardar) | -> `COLETA_INFO` ou `DIAGNOSTICO` quando cliente responde; -> `FINALIZADO` por timeout |
| `FINALIZADO` | Problema resolvido ou timeout | Enviar CSAT, encerrar | Terminal |

### 2.3 Armazenamento de Estado

**Proposta:** Usar o campo `context` (JSONB) ja existente em `ai_conversations`:

```typescript
interface ConversationState {
  // Estado atual da state machine
  current_state: 'nova_conversa' | 'saudacao' | 'coleta_info' | 'diagnostico' |
                 'resolucao' | 'feedback' | 'escalacao' | 'handoff' |
                 'aguardando_cliente' | 'finalizado'

  // Dados coletados durante a conversa
  collected_data: {
    client_name?: string
    client_identified?: boolean
    problem_description?: string
    problem_category?: string
    affected_system?: string
    error_message?: string
    since_when?: string
    already_tried?: string[]
    urgency_confirmed?: 'low' | 'medium' | 'high' | 'critical'
  }

  // Controle de topicos
  topics: Array<{
    id: string
    description: string
    status: 'active' | 'resolved' | 'escalated'
    started_at: string
  }>
  active_topic_id: string | null

  // Re-engagement
  followup_count: number  // ja existe
  last_agent_question?: string
  awaiting_response_since?: string

  // Historico de transicoes
  state_history: Array<{
    from: string
    to: string
    reason: string
    timestamp: string
  }>
}
```

---

## 3. Fluxos por Tipo de Atendimento

### 3.1 Suporte Tecnico (`specialty: 'support'`)

```
SAUDACAO
  "Ola! Sou o assistente de suporte tecnico da Sismais."
  [Identificar cliente via auto-link ou customer_search]

COLETA_INFO
  Perguntas obrigatorias:
  1. "Qual sistema esta com problema?" (Sismais GL, Admin, etc.)
  2. "O que exatamente acontece? Aparece alguma mensagem de erro?"
  3. "Desde quando isso esta acontecendo?"
  4. "Voce ja tentou alguma solucao?"

  Dados minimos para avancar: sistema + descricao do erro

DIAGNOSTICO
  1. Buscar RAG filtrando por produto do cliente (knowledge_products)
  2. Se RAG score > 0.85: apresentar solucao diretamente
  3. Se RAG score 0.70-0.85: apresentar solucao com ressalva
  4. Se RAG score < 0.70: escalar

RESOLUCAO
  Formato padrao:
  "Encontrei uma solucao para o seu problema:
   1. [passo 1]
   2. [passo 2]
   3. [passo 3]

   Pode tentar e me dizer se funcionou?"

FEEDBACK
  Se "resolveu" -> [RESOLVED] -> FINALIZADO
  Se "nao resolveu" -> "Vou tentar outra abordagem..." -> DIAGNOSTICO
  Se 2+ tentativas falharam -> ESCALACAO
```

### 3.2 Financeiro (`specialty: 'financial'`)

```
SAUDACAO
  "Ola! Sou o assistente financeiro da Sismais."
  [Identificar cliente — OBRIGATORIO antes de qualquer info financeira]

COLETA_INFO
  Perguntas obrigatorias:
  1. Identificacao do cliente (CNPJ/CPF) — NAO prosseguir sem isso
  2. "Qual sua duvida financeira?" (boleto, nota fiscal, contrato, etc.)

  REGRA DE SEGURANCA: Nunca informar dados financeiros sem
  confirmar identidade do cliente via customer_search

DIAGNOSTICO
  1. Executar customer_search com documento do cliente
  2. Buscar dados financeiros via sismais-admin-proxy
  3. Categorizar: boleto (2a via), cobranca, negociacao, nota fiscal

RESOLUCAO
  - Boleto: Gerar 2a via (tool) + enviar link
  - Cobranca: Informar valor + vencimento + opcoes de pagamento
  - Nota fiscal: Consultar status + enviar PDF se disponivel
  - Negociacao: Coletar proposta -> ESCALACAO para humano

FEEDBACK
  Confirmar resolucao -> CSAT -> FINALIZADO
```

### 3.3 Vendas / SDR (`specialty: 'sales'` / `'sdr'`)

```
SAUDACAO
  "Ola! Que bom que se interessou pela Sismais!"

COLETA_INFO (qualificacao)
  Perguntas BANT:
  1. "Qual o ramo da sua empresa?" (Budget implicito)
  2. "Quantos funcionarios?" (Authority — porte)
  3. "Qual problema quer resolver?" (Need)
  4. "Tem urgencia para implementar?" (Timeline)

  Lead scoring automatico baseado nas respostas

DIAGNOSTICO
  - Score alto (>= 70): Lead qualificado -> agendar demo
  - Score medio (40-69): Nutrir -> enviar material
  - Score baixo (< 40): Responder duvidas -> FINALIZADO

RESOLUCAO
  - Qualificado: "Vou agendar uma demonstracao. Qual melhor horario?"
  - Nutricao: Enviar link de material + follow-up agendado

ESCALACAO
  - Lead qualificado sempre escala para vendedor humano
  - Incluir briefing: score, respostas BANT, interesse principal
```

### 3.4 Triagem (`specialty: 'triage'`)

```
SAUDACAO
  "Ola! Como posso ajudar?"

COLETA_INFO (minima)
  1. "Voce e cliente Sismais?" (para direcionar)
  2. "Resumidamente, qual sua necessidade?" (para classificar)

DIAGNOSTICO
  Usar message-analyzer para classificar:
  - intent: billing/payment -> redirecionar para 'financial'
  - intent: technical/bug/error -> redirecionar para 'support'
  - intent: purchase/pricing -> redirecionar para 'sales'
  - intent: want_human -> ESCALACAO direta

  TRANSICAO: Atualizar current_agent_id no orchestrator
  NAO responder o problema — apenas classificar e redirecionar
```

---

## 4. Regras de Re-engagement

### 4.1 Estado Atual

O `check-inactive-conversations` implementa 3 niveis de follow-up:

| Nivel | Timeout Padrao | Mensagem | Acao |
|---|---|---|---|
| 1o follow-up | 15 min | "Ainda esta por ai?" | Incrementa followup_count |
| 2o follow-up | 45 min | "Vamos encerrar se nao retornar" | Incrementa followup_count |
| Encerramento | 120 min | "Encerrando por inatividade" | Status -> `finalizado` |

### 4.2 Lacunas e Propostas

#### Lacuna 1: So age em conversas `handler_type=ai`

**Problema:** Conversas escaladas para humano (`handler_type='human'`) que nenhum humano atende ficam abandonadas indefinidamente.

**Proposta:** Adicionar verificacao para conversas humanas sem resposta:

```
check-inactive-conversations deve tambem verificar:
- handler_type = 'human'
- status = 'em_atendimento' ou 'aguardando'
- ultima mensagem (qualquer role) > X minutos

Acao:
- 15 min sem resposta humana: Notificar supervisor
- 30 min sem resposta humana: Devolver para IA com mensagem
  "Nossos atendentes estao ocupados. Posso tentar te ajudar enquanto isso?"
- handler_type volta para 'ai', mas marca flag 'was_escalated' no context
```

#### Lacuna 2: Follow-ups genericos

**Problema:** As 3 mensagens de follow-up sao identicas para qualquer tipo de conversa.

**Proposta:** Follow-ups contextuais baseados no estado da conversa:

| Estado quando inativo | 1o Follow-up | 2o Follow-up |
|---|---|---|
| `COLETA_INFO` | "Percebi que voce estava me contando sobre {problema}. Posso continuar te ajudando?" | "Precisa de mais tempo? Estarei aqui quando puder responder." |
| `AGUARDANDO_CLIENTE` (pos-solucao) | "Conseguiu testar a solucao que sugeri? Se precisar de ajuda, e so falar!" | "Vou considerar que a solucao funcionou. Se precisar, estamos aqui!" |
| `DIAGNOSTICO` | "Ainda estou analisando seu caso. Precisa de algo mais?" | Mensagem padrao |
| `ESCALACAO` (aguardando humano) | "Seu atendimento esta na fila. Vou verificar a disponibilidade." | "Desculpe a demora. Posso tentar resolver via IA enquanto aguarda?" |

#### Lacuna 3: Re-engagement proativo (conversas resolvidas)

**Proposta:** Follow-up pos-resolucao para CSAT:

```
24h apos status='finalizado' e ai_resolved=true:
  "Ola! Ontem resolvemos uma questao sobre {resumo}.
   Tudo continua funcionando? De 1 a 5, como avalia o atendimento?"
```

### 4.3 Configuracao de Timeouts

**Proposta:** Mover timeouts para `support_config` do agente (JSONB em `ai_agents`):

```typescript
interface ReEngagementConfig {
  first_followup_minutes: number    // default: 15
  second_followup_minutes: number   // default: 45
  close_minutes: number             // default: 120
  human_escalation_timeout_minutes: number  // default: 30
  post_resolution_csat_hours: number // default: 24
  contextual_followups: boolean     // default: true
}
```

---

## 5. Estrategia de Gestao de Contexto

### 5.1 Problema Atual

O `agent-executor` usa uma janela deslizante de **8 mensagens recentes** + **resumo da conversa** (gerado por `summarize-conversation`). Isso e funcional, mas tem limitacoes:

1. **8 mensagens podem nao cobrir o contexto necessario** — ex: cliente deu CNPJ na mensagem 2, agente esta na mensagem 12
2. **Resumo e generico** — nao destaca dados estruturados (nome, documento, sistema)
3. **Sem prioridade de informacao** — mensagens de "ok" e "obrigado" ocupam slots iguais a mensagens com dados criticos

### 5.2 Proposta: Contexto em 3 Camadas

```
┌────────────────────────────────────────────────┐
│ CAMADA 1: Dados Estruturados (sempre presente) │
│ • Nome: Joao Silva                              │
│ • CNPJ: 12.345.678/0001-90                      │
│ • Sistema: Sismais GL                           │
│ • Problema: Erro ao emitir NF                   │
│ • Estado: DIAGNOSTICO                           │
│ • Topico ativo: "Erro NF-e 500"                 │
│ ~200 tokens                                     │
├────────────────────────────────────────────────┤
│ CAMADA 2: Resumo Compactado (se conversa longa)│
│ • Resumo das mensagens anteriores ao window     │
│ • Gerado por summarize-conversation             │
│ ~300-500 tokens                                 │
├────────────────────────────────────────────────┤
│ CAMADA 3: Mensagens Recentes (window)           │
│ • Ultimas N mensagens (N = 6 a 10)             │
│ • Filtrar: remover "ok", "obrigado" isolados    │
│ ~400-800 tokens                                 │
└────────────────────────────────────────────────┘
Total estimado: 900-1500 tokens de contexto
```

### 5.3 Implementacao da Camada 1

A Camada 1 (dados estruturados) e a mais critica e a mais facil de implementar. Proposta:

1. **Extrair dados durante `COLETA_INFO`**: Quando o agente detecta informacoes relevantes (nome, documento, sistema), salvar em `context.collected_data`
2. **Injetar como system message**: No `agent-executor`, antes do historico de mensagens, injetar:

```
[DADOS DO CLIENTE]
Nome: {collected_data.client_name}
Documento: {collected_data.client_document}
Sistema: {collected_data.affected_system}
Problema: {collected_data.problem_description}
Estado da conversa: {current_state}
```

3. **Atualizacao incremental**: Cada resposta do LLM pode incluir marcador `[DATA_UPDATE]` para atualizar `collected_data` sem re-perguntar.

### 5.4 Filtragem Inteligente de Historico

Proposta para otimizar a janela de mensagens:

```typescript
function filterRelevantMessages(messages: Message[], windowSize: number): Message[] {
  // 1. Sempre incluir a primeira mensagem do usuario (contexto inicial)
  // 2. Sempre incluir mensagens com dados estruturados (CNPJ, nome, etc.)
  // 3. Remover mensagens triviais ("ok", "sim", "obrigado") se nao sao a ultima
  // 4. Incluir as ultimas N mensagens
  // 5. Cap total em windowSize
}
```

---

## 6. Deteccao de Intencao Refinada

### 6.1 Limitacoes do message-analyzer Atual

O `message-analyzer` retorna:
- `intent`: string generica (ex: "billing_question", "technical_support")
- `sentiment`: positive / neutral / negative
- `urgency`: low / medium / high / critical

**Falta:**
- Deteccao de **mudanca de topico** (cliente muda de assunto)
- Deteccao de **dados estruturados** na mensagem (CNPJ, email, telefone)
- Deteccao de **intencao de encerramento** vs **nova pergunta**
- **Satisfacao progressiva** (cliente esta ficando frustrado?)

### 6.2 Proposta: Enriquecer Analise

Adicionar ao output do `message-analyzer`:

```typescript
interface EnrichedAnalysis {
  // Existentes
  intent: string
  sentiment: string
  urgency: string
  keywords: string[]
  suggested_category: string
  embedding: number[]

  // Novos campos
  topic_change: boolean         // true se cliente mudou de assunto
  extracted_data: {             // dados estruturados detectados
    cpf?: string
    cnpj?: string
    email?: string
    phone?: string
    system_name?: string
    error_code?: string
  }
  conversation_signal: 'continue' | 'new_topic' | 'closing' | 'escalation' | 'confirmation'
  frustration_level: number     // 0.0 a 1.0, acumulativo ao longo da conversa
}
```

### 6.3 Implementacao Sugerida

O custo de adicionar esses campos ao `message-analyzer` e minimo — basta ajustar o prompt do LLM (ja usa Flash Lite, barato). Adicionar ao prompt:

```
Alem dos campos existentes, inclua tambem:
- "topic_change": true se a mensagem muda completamente de assunto vs historico
- "extracted_data": objeto com dados estruturados detectados (cpf, cnpj, email, phone, system_name, error_code) — extrair se presentes
- "conversation_signal": "continue" (segue no mesmo topico), "new_topic" (assunto novo), "closing" (quer encerrar), "escalation" (quer humano), "confirmation" (confirma algo)
- "frustration_level": 0.0 a 1.0 baseado no tom acumulado (0=tranquilo, 1=muito frustrado)
```

---

## 7. Gestao de Topicos

### 7.1 Problema

Um cliente pode, numa mesma conversa:
1. Perguntar sobre um boleto (topico 1)
2. Depois perguntar sobre um erro no sistema (topico 2)
3. Voltar a perguntar sobre o boleto (retomar topico 1)

Hoje, o sistema trata tudo como uma unica conversa linear sem distincao.

### 7.2 Proposta

Usar o campo `topics` em `context` para rastrear topicos:

```typescript
// Quando message-analyzer detecta topic_change = true:
// 1. Pausar topico atual (status: 'paused')
// 2. Criar novo topico
// 3. Se topico similar ja existe (por embedding similarity), retomar

// Quando agent-executor responde:
// 1. Incluir no system prompt: "Topico ativo: {topic.description}"
// 2. Se topico resolvido: marcar status='resolved'
// 3. Se todos topicos resolvidos: transicionar para FEEDBACK

// Quando orchestrator recebe topic_change:
// 1. Verificar se novo topico requer agente diferente
// 2. Se sim: trocar agente mas preservar context completo
```

### 7.3 Transicao Suave entre Agentes

Quando o orchestrator troca de agente (ex: support -> financial):

```typescript
// 1. Gerar briefing automatico (via summarize-conversation ou inline)
const briefing = `Cliente ${collected_data.client_name} estava sendo atendido
por ${previous_agent.name} sobre "${previous_topic.description}".
Agora precisa de ajuda com: "${new_topic.description}".
Dados ja coletados: ${JSON.stringify(collected_data)}`

// 2. Injetar como system message no novo agente
// 3. Novo agente NAO repete saudacao — continua fluido:
// "Entendi, voce agora precisa de ajuda com a parte financeira.
//  Ja vi que voce e o Joao da empresa X. Sobre o boleto..."
```

---

## 8. Experiencia Multi-Canal

### 8.1 Estado Atual

100% WhatsApp via UAZAPI. O campo `communication_channel` existe em `ai_conversations` mas nao e usado para logica.

### 8.2 Proposta para Consistencia Multi-Canal

Quando novos canais forem adicionados (Instagram, webchat):

1. **Mesma state machine** — os estados e transicoes sao independentes de canal
2. **Contexto persistente** — se cliente muda de canal, o `context` (JSONB) acompanha
3. **Identificacao cross-canal** — vincular pelo telefone, email ou documento
4. **Adaptacao de formato** — canal afeta apenas a formatacao da mensagem:
   - WhatsApp: *negrito*, emojis, limite 4096 chars
   - Webchat: markdown completo, sem limite
   - Instagram: sem formatacao rica, limite 1000 chars

```typescript
interface ChannelConfig {
  max_message_length: number
  supports_formatting: boolean
  formatting_style: 'whatsapp' | 'markdown' | 'plain'
  supports_media: boolean
  supports_buttons: boolean  // WhatsApp lista/botoes
}
```

---

## 9. Propostas de Implementacao — Prioridade

### Fase 1: Quick Wins (1-2 semanas)

| # | Proposta | Arquivo a Modificar | Esforco |
|---|---|---|---|
| C1 | Adicionar `current_state` ao `context` JSONB | `agent-executor/index.ts` | 2h |
| C2 | Injetar estado no system prompt do agente | `agent-executor/index.ts` | 1h |
| C3 | Enriquecer `message-analyzer` com `extracted_data` e `topic_change` | `message-analyzer/index.ts` | 2h |
| C4 | Follow-ups contextuais baseados no estado | `check-inactive-conversations/index.ts` | 3h |
| C5 | Re-engagement para conversas humanas sem resposta | `check-inactive-conversations/index.ts` | 3h |

### Fase 2: Gestao de Contexto (2-3 semanas)

| # | Proposta | Arquivo a Modificar | Esforco |
|---|---|---|---|
| C6 | Camada 1 — dados estruturados no contexto | `agent-executor/index.ts` | 4h |
| C7 | Atualizacao incremental de `collected_data` via marcador LLM | `agent-executor/index.ts` | 4h |
| C8 | Filtragem inteligente de historico (remover triviais) | `agent-executor/index.ts` | 3h |
| C9 | Briefing automatico na troca de agente | `orchestrator/index.ts` + `agent-executor/index.ts` | 4h |

### Fase 3: State Machine Completa (3-4 semanas)

| # | Proposta | Arquivo a Modificar | Esforco |
|---|---|---|---|
| C10 | State machine engine com transicoes automaticas | Novo: `_shared/conversation-state.ts` | 8h |
| C11 | Gestao de topicos com pausa/retomada | `agent-executor/index.ts` + state engine | 6h |
| C12 | Deteccao de frustacao progressiva + intervencao | `message-analyzer/index.ts` + `orchestrator/index.ts` | 4h |
| C13 | CSAT proativo pos-resolucao (24h) | `check-inactive-conversations/index.ts` ou novo cron | 3h |
| C14 | Timeouts configuraveis por agente em `support_config` | `check-inactive-conversations/index.ts` + `ai_agents` | 3h |

**Estimativa total: ~50h de trabalho**

---

## 10. Resumo de Decisoes Arquiteturais

| Decisao | Escolha | Justificativa |
|---|---|---|
| Onde armazenar estado? | `ai_conversations.context` (JSONB) | Ja existe, sem migration, flexivel |
| State machine server-side ou no prompt? | Hibrido — estado salvo no DB, transicoes decididas pelo LLM + regras | LLM e bom para decidir transicoes ambiguas, regras para transicoes deterministicas |
| Quantas camadas de contexto? | 3 (dados estruturados + resumo + window) | Equilibrio entre completude e economia de tokens |
| Re-engagement configuraval por agente? | Sim, via `support_config` | Diferentes agentes tem diferentes SLAs |
| Multi-canal — abstrair agora? | Nao — preparar mas nao implementar | Prioridade e estabilizar WhatsApp primeiro (alinhado com E16 ADR-004) |

---

*Relatorio gerado em 2026-03-19. Revisao recomendada apos implementacao da Fase 1.*
