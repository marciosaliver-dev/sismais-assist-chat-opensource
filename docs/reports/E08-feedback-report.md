# E08 — Sistema de Feedback Loop para Agentes IA

**Data:** 2026-03-19
**Autor:** Especialista em Feedback Loop (analise automatizada)
**Escopo:** Design do sistema de aprendizado continuo para 7 agentes IA do Sismais Helpdesk

---

## 1. Estado Atual do Feedback Loop

### 1.1 O que ja existe

| Componente | Status | Localizacao |
|-----------|--------|-------------|
| `learning-loop` edge function | Implementado | `supabase/functions/learning-loop/index.ts` |
| `extract-conversation-knowledge` | Implementado | `supabase/functions/extract-conversation-knowledge/index.ts` |
| `evaluate-service` | Implementado | `supabase/functions/evaluate-service/index.ts` |
| Tabela `ai_learning_feedback` | Existe | Campos: feedback_type, feedback_source, corrected_response, learning_action |
| Tabela `ai_service_evaluations` | Existe | Campos: overall_score, criteria (JSON), strengths, improvements |
| Campo `confidence` em `ai_messages` | Existe | Calculado pelo agent-executor com 6 sinais |
| Campo `success_rate` em `ai_agents` | Existe | Atualizado via RPCs |
| Campo `avg_confidence` em `ai_agents` | Existe | Metrica agregada |
| Campo `avg_csat` em `ai_agents` | Existe | Metrica agregada |
| RPCs `adjust_agent_confidence`, `increment_agent_success` | Existem | Ajustam threshold automaticamente |

### 1.2 Lacunas Criticas

1. **Nenhuma interface UI de feedback** — O `learning-loop` so e acionado por sistema (CSAT, escalacao, feedback implicito). Nao ha tela para supervisores aprovarem/rejeitarem respostas.
2. **Pipeline desconectado** (E16 item D1) — O webhook nao chama `process-incoming-message`, logo o `learning-loop` nunca e invocado em producao.
3. **Correcoes humanas nao capturadas** — Quando um agente humano assume e responde, a correcao nao e registrada como dado de treinamento.
4. **Sem dashboard de evolucao** — Metricas existem no banco mas nao ha visualizacao.
5. **Sem deteccao de padroes de erro** — Nao ha analise de perguntas recorrentes que sempre escalam.

---

## 2. Design do Sistema de Feedback

### 2.1 Diagrama do Pipeline Completo

```
                        ┌─────────────────────────────────────┐
                        │        FONTES DE FEEDBACK            │
                        └─────────┬───────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────────┐
              │                   │                       │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌──────────▼─────────┐
    │  EXPLICITO      │  │  IMPLICITO       │  │  SISTEMATICO        │
    │                 │  │                  │  │                     │
    │ - Supervisor    │  │ - Palavras       │  │ - CSAT rating       │
    │   aprova/rejeita│  │   positivas      │  │ - Escalacao p/      │
    │ - Correcao de   │  │ - Sentimento     │  │   humano            │
    │   resposta      │  │   da proxima msg │  │ - Tempo resolucao   │
    │ - Rating manual │  │ - Cliente volta  │  │ - evaluate-service  │
    │   (thumbs)      │  │   a perguntar    │  │   (LLM avaliador)   │
    └────────┬────────┘  └────────┬─────────┘  └──────────┬──────────┘
             │                    │                        │
             └────────────────────┼────────────────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │    ai_learning_feedback   │
                     │  (tabela centralizada)    │
                     └────────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────────┐
              │                   │                       │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌──────────▼─────────┐
    │  AJUSTE DE       │  │  KNOWLEDGE BASE  │  │  METRICAS           │
    │  AGENTE          │  │                  │  │                     │
    │                  │  │ - Criar doc      │  │ - Atualizar         │
    │ - confidence_    │  │   auto (Q&A)     │  │   success_rate      │
    │   threshold      │  │ - Sugerir novos  │  │ - Atualizar         │
    │ - success_rate   │  │   artigos        │  │   avg_confidence    │
    │ - system_prompt  │  │ - Preencher gaps │  │ - Dashboard de      │
    │   refinamento    │  │                  │  │   evolucao          │
    └──────────────────┘  └──────────────────┘  └─────────────────────┘
```

### 2.2 Fluxo de Feedback Explicito (Supervisor)

```
Agente IA responde → Mensagem salva em ai_messages (confidence, rag_sources)
                                    │
                    ┌───────────────▼───────────────────┐
                    │  FILA DE REVISAO (UI)              │
                    │  Filtros: confidence < 0.7,        │
                    │  agente especifico, ultimas 24h    │
                    └───────────────┬───────────────────┘
                                    │
                         Supervisor revisa
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
         ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
         │  APROVAR     │    │  CORRIGIR    │    │  REJEITAR    │
         │  (thumbs up) │    │  (editar e   │    │  (thumbs     │
         │              │    │  salvar)     │    │  down)       │
         └──────┬───────┘    └──────┬──────┘    └──────┬──────┘
                │                   │                   │
                ▼                   ▼                   ▼
         feedback_type:      feedback_type:      feedback_type:
         'approved'          'corrected'          'rejected'
         learning_action:    learning_action:     learning_action:
         'reinforce'         'create_knowledge'   'increase_threshold'
                             + corrected_response
                             salvo no campo
```

---

## 3. Componentes UI Necessarios

### 3.1 Pagina: Supervisao de IA (`/ai-supervisor`)

**Descricao:** Dashboard principal do supervisor para revisar respostas de IA e fornecer feedback.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR                                                        │
├──────────────────────────────────────────────────────────────┤
│ AI Supervisor                                    [Filtros ▼]  │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                  │
│ FILA DE    │  PAINEL DE REVISAO                              │
│ REVISAO    │                                                  │
│            │  Conversa #1234 — Agente: Suporte Tecnico       │
│ ● #1234    │  Confidence: 0.58  ⚠️                           │
│   0.58     │                                                  │
│ ● #1235    │  [Cliente]: Nao consigo emitir NFe...           │
│   0.62     │  [IA]: Para emitir a NFe voce precisa...        │
│ ● #1236    │                                                  │
│   0.71     │  RAG Sources: [Doc 1] [Doc 2]                   │
│            │                                                  │
│            │  ┌──────────────────────────────────────┐       │
│            │  │ Resposta corrigida (opcional):        │       │
│            │  │ ____________________________________  │       │
│            │  │                                       │       │
│            │  └──────────────────────────────────────┘       │
│            │                                                  │
│            │  [✓ Aprovar]  [✏ Corrigir e Salvar]  [✗ Rejeitar]│
│            │                                                  │
├────────────┴─────────────────────────────────────────────────┤
│ METRICAS RAPIDAS                                              │
│ Pendentes: 12  │  Aprovadas hoje: 34  │  Corrigidas: 8       │
└──────────────────────────────────────────────────────────────┘
```

**Componentes React:**

| Componente | Arquivo | Descricao |
|-----------|---------|-----------|
| `AIReviewQueue` | `src/components/ai-supervisor/AIReviewQueue.tsx` | Lista lateral de mensagens pendentes de revisao, ordenada por confidence (menor primeiro) |
| `AIReviewPanel` | `src/components/ai-supervisor/AIReviewPanel.tsx` | Painel central com conversa, resposta IA, fontes RAG, e acoes |
| `AIReviewActions` | `src/components/ai-supervisor/AIReviewActions.tsx` | Botoes de aprovar/corrigir/rejeitar com textarea para correcao |
| `AIReviewMetrics` | `src/components/ai-supervisor/AIReviewMetrics.tsx` | Barra inferior com contadores rapidos |
| `AIReviewFilters` | `src/components/ai-supervisor/AIReviewFilters.tsx` | Filtros: agente, periodo, faixa de confidence, status |

**Query principal:**
```sql
SELECT m.id, m.content, m.confidence, m.agent_id, m.rag_sources,
       m.created_at, m.conversation_id,
       a.name as agent_name, a.specialty,
       c.customer_name, c.ticket_number,
       prev.content as user_message
FROM ai_messages m
JOIN ai_agents a ON a.id = m.agent_id
JOIN ai_conversations c ON c.id = m.conversation_id
LEFT JOIN ai_messages prev ON prev.conversation_id = m.conversation_id
  AND prev.role = 'user'
  AND prev.created_at < m.created_at
LEFT JOIN ai_learning_feedback lf ON lf.message_id = m.id
  AND lf.feedback_source = 'supervisor'
WHERE m.role = 'assistant'
  AND m.deleted_at IS NULL
  AND lf.id IS NULL  -- ainda nao revisada
  AND m.confidence < 0.8  -- threshold configuravel
ORDER BY m.confidence ASC, m.created_at DESC
LIMIT 50
```

### 3.2 Componente: Inline Feedback (no Chat)

**Descricao:** Botoes de thumbs up/down ao lado de cada mensagem IA no inbox.

**Integracao:** Adicionar ao componente `MessageList.tsx` existente.

```
┌─────────────────────────────────────┐
│ [IA]: Para resolver esse problema,  │
│ voce precisa acessar o menu...      │
│                          👍 👎 ✏️   │
└─────────────────────────────────────┘
```

**Comportamento:**
- 👍 → Insere `ai_learning_feedback` com `feedback_type: 'helpful'`, `feedback_source: 'inline_agent'`
- 👎 → Abre modal para agente escrever a resposta correta
- ✏️ → Abre textarea pre-preenchida para editar a resposta

### 3.3 Pagina: Dashboard de Evolucao (`/ai-evolution`)

**Descricao:** Graficos de evolucao dos agentes ao longo do tempo.

**Metricas exibidas:**
- Grafico de linha: confidence media por semana por agente
- Grafico de linha: taxa de aprovacao por semana
- Grafico de barras: escalacoes por agente por periodo
- Grafico de pizza: distribuicao de feedback (aprovado/corrigido/rejeitado)
- Tabela: top 10 perguntas que mais escalam

---

## 4. Metricas Propostas por Agente

### 4.1 Metricas de Qualidade

| Metrica | Calculo | Fonte | Meta |
|---------|---------|-------|------|
| **Taxa de Resolucao Autonoma** | Conversas `ai_resolved = true` / total | `ai_conversations` | >= 40% |
| **Confidence Media** | AVG(confidence) das respostas | `ai_messages` | >= 0.75 |
| **Taxa de Escalacao** | Conversas escaladas para humano / total | `ai_conversations.handler_type = 'human'` | <= 30% |
| **CSAT Medio** | AVG(csat_rating) das conversas do agente | `ai_conversations.csat_rating` | >= 4.0/5.0 |
| **Taxa de Aprovacao (supervisor)** | Feedback 'approved' / total revisados | `ai_learning_feedback` | >= 80% |
| **Taxa de Correcao** | Feedback 'corrected' / total revisados | `ai_learning_feedback` | <= 15% |
| **Taxa de Rejeicao** | Feedback 'rejected' / total revisados | `ai_learning_feedback` | <= 5% |

### 4.2 Metricas de Eficiencia

| Metrica | Calculo | Fonte | Meta |
|---------|---------|-------|------|
| **Tempo Medio de Resolucao** | AVG(resolution_time_seconds) | `ai_conversations` | < 180s |
| **Custo por Atendimento** | AVG(cost_usd) por conversa | `ai_messages.cost_usd` | < $0.05 |
| **RAG Hit Rate** | Respostas com rag_sources > 0 / total | `ai_messages.rag_sources` | >= 60% |
| **Tokens Medios por Resposta** | AVG(total_tokens) | `ai_messages` | < 2000 |

### 4.3 Metricas de Aprendizado

| Metrica | Calculo | Fonte | Meta |
|---------|---------|-------|------|
| **Knowledge Docs Gerados** | COUNT docs com source = 'conversation_learning' | `ai_knowledge_base` | Crescente |
| **Confidence Threshold Atual** | Valor atual do threshold | `ai_agents.confidence_threshold` | Decrescente (agente melhora) |
| **Feedback Positivo Implicito** | COUNT feedback_source = 'implicit_positive' | `ai_learning_feedback` | Crescente |
| **Perguntas sem Resposta RAG** | Respostas com RAG enabled mas 0 docs | `ai_messages` | Decrescente |

---

## 5. Deteccao de Padroes de Erro Recorrentes

### 5.1 Algoritmo Proposto

**Objetivo:** Identificar perguntas que consistentemente resultam em escalacao ou baixa confianca.

**Implementacao:** Nova edge function `detect-error-patterns`.

```
1. Buscar ultimas N conversas escaladas (handler_type = 'human')
2. Para cada conversa, pegar a ultima mensagem do usuario antes da escalacao
3. Gerar embedding da mensagem
4. Agrupar mensagens por similaridade semantica (threshold > 0.85)
5. Clusters com >= 3 ocorrencias em 7 dias = padrao de erro
6. Para cada padrao:
   a. Verificar se existe doc na knowledge base (RAG search)
   b. Se NAO existe → sugerir criacao de artigo
   c. Se existe mas confidence baixa → sugerir revisao do artigo
```

**Tabela sugerida:** `ai_error_patterns`

```sql
CREATE TABLE ai_error_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_description TEXT NOT NULL,       -- descricao gerada por LLM
  example_messages TEXT[] NOT NULL,        -- mensagens de exemplo
  occurrence_count INT DEFAULT 1,
  agent_ids UUID[],                        -- agentes afetados
  avg_confidence FLOAT,
  suggested_action TEXT,                   -- 'create_knowledge' | 'update_knowledge' | 'adjust_prompt'
  suggested_content TEXT,                  -- conteudo sugerido para knowledge base
  knowledge_doc_id UUID REFERENCES ai_knowledge_base(id),
  status TEXT DEFAULT 'pending',           -- 'pending' | 'addressed' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now(),
  addressed_at TIMESTAMPTZ
);
```

### 5.2 UI: Painel de Padroes de Erro

Integrado na pagina `/ai-supervisor` como aba separada.

```
┌──────────────────────────────────────────────────────────┐
│ [Fila de Revisao]  [Padroes de Erro]  [Evolucao]         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ ⚠️ Padrao: "Como emitir NFe no Sismais GL"              │
│   Ocorrencias: 12 nos ultimos 7 dias                     │
│   Agentes: Suporte Tecnico, Triage                       │
│   Confidence media: 0.42                                 │
│   Status: Sem documento na knowledge base                │
│   [Criar Artigo]  [Dispensar]                            │
│                                                           │
│ ⚠️ Padrao: "Boleto vencido como pagar"                  │
│   Ocorrencias: 8 nos ultimos 7 dias                      │
│   Agentes: Financeiro                                    │
│   Confidence media: 0.55                                 │
│   Status: Doc existe mas desatualizado (2025-09)         │
│   [Atualizar Artigo]  [Dispensar]                        │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Sugestao Automatica de Novos Documentos

### 6.1 Pipeline de Sugestao

```
detect-error-patterns (semanal)
        │
        ▼
┌──────────────────────┐
│ Identificar gaps:     │
│ - Perguntas sem RAG   │
│ - Baixa similarity    │
│ - Alta escalacao       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Gerar rascunho via    │
│ LLM (Gemini Flash):   │
│ - Titulo              │
│ - Conteudo sugerido   │
│ - Tags                │
│ - Categoria           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Salvar em             │
│ ai_knowledge_base com │
│ status = 'draft'      │
│ source = 'ai_suggest' │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Supervisor revisa na  │
│ pagina /knowledge:    │
│ - Aprovar e publicar  │
│ - Editar e publicar   │
│ - Rejeitar            │
└──────────────────────┘
```

### 6.2 Fontes de Sugestao

| Fonte | Trigger | Prioridade |
|-------|---------|-----------|
| Padrao de erro recorrente | >= 3 escalacoes similares em 7 dias | Alta |
| Correcao de supervisor | `feedback_type = 'corrected'` com resposta nova | Media |
| Conversa resolvida de alta qualidade | CSAT >= 4 + confidence >= 0.90 | Media |
| Pergunta sem match RAG | RAG enabled + 0 docs retornados | Baixa |

---

## 7. Pipeline de Melhoria Continua

### 7.1 Ciclo Semanal

```
┌─────────────────────────────────────────────────────────────┐
│                   CICLO SEMANAL DE MELHORIA                  │
│                                                              │
│  SEG-SEX: Coleta de feedback                                │
│  ├─ Supervisores revisam fila de mensagens de baixa conf.   │
│  ├─ Feedback inline dos agentes humanos                     │
│  ├─ CSAT automatico pos-resolucao                           │
│  └─ Feedback implicito (sentimento da proxima mensagem)     │
│                                                              │
│  SABADO: Processamento automatico (cron)                    │
│  ├─ detect-error-patterns analisa ultimos 7 dias            │
│  ├─ Gerar rascunhos de artigos para gaps identificados      │
│  ├─ Recalcular success_rate de cada agente                  │
│  └─ Gerar relatorio semanal de evolucao                     │
│                                                              │
│  SEGUNDA: Revisao do supervisor                             │
│  ├─ Aprovar/editar artigos sugeridos                        │
│  ├─ Revisar padroes de erro e tomar acoes                   │
│  └─ Ajustar system prompts se necessario                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Ajustes Automaticos

| Evento | Acao Automatica | Ja Implementado? |
|--------|----------------|-----------------|
| Escalacao para humano | `confidence_threshold += 5%` | Sim (learning-loop) |
| CSAT >= 4 | `confidence_threshold -= 2%`, `increment_agent_success` | Sim (learning-loop) |
| CSAT < 4 | `confidence_threshold += 3%` | Sim (learning-loop) |
| Feedback implicito positivo | `confidence_threshold -= 2%`, `increment_agent_success` | Sim (learning-loop) |
| Supervisor aprova | `confidence_threshold -= 1%` | **NAO — implementar** |
| Supervisor corrige | Criar doc na KB, nao ajustar threshold | **NAO — implementar** |
| Supervisor rejeita | `confidence_threshold += 5%` | **NAO — implementar** |
| Conversa de alta qualidade | Extract Q&A pairs para KB | Sim (extract-conversation-knowledge) |

---

## 8. Propostas de Implementacao

### 8.1 Fase 1 — Fundacao (1-2 semanas)

**Pre-requisito critico:** Resolver E16 item D1 (conectar webhook ao pipeline completo). Sem isso, o learning-loop nunca executa em producao.

| # | Tarefa | Tipo | Esforco |
|---|--------|------|---------|
| F1.1 | Corrigir pipeline (D1 do E16) para que learning-loop funcione | Backend | 2h |
| F1.2 | Criar migration para tabela `ai_error_patterns` | DB | 1h |
| F1.3 | Adicionar campo `status` em `ai_knowledge_base` ('published', 'draft', 'archived') | DB | 1h |
| F1.4 | Criar edge function `submit-feedback` que recebe feedback do supervisor e aplica acoes | Backend | 4h |
| F1.5 | Criar RPC `get_agent_metrics` que retorna metricas agregadas por agente | DB | 2h |

### 8.2 Fase 2 — Interface de Supervisor (2-3 semanas)

| # | Tarefa | Tipo | Esforco |
|---|--------|------|---------|
| F2.1 | Pagina `/ai-supervisor` com fila de revisao + painel | Frontend | 8h |
| F2.2 | Componente inline feedback (thumbs) no MessageList | Frontend | 3h |
| F2.3 | Componente `AIReviewActions` com aprovar/corrigir/rejeitar | Frontend | 4h |
| F2.4 | Filtros por agente, periodo, faixa de confidence | Frontend | 2h |
| F2.5 | Adicionar rota e item no sidebar | Frontend | 1h |

### 8.3 Fase 3 — Deteccao de Padroes (2-3 semanas)

| # | Tarefa | Tipo | Esforco |
|---|--------|------|---------|
| F3.1 | Edge function `detect-error-patterns` | Backend | 6h |
| F3.2 | Edge function `suggest-knowledge-doc` (gera rascunho via LLM) | Backend | 4h |
| F3.3 | Aba "Padroes de Erro" na pagina de supervisor | Frontend | 4h |
| F3.4 | Aba "Sugestoes" na pagina /knowledge para artigos draft | Frontend | 3h |
| F3.5 | Cron job semanal para executar detect-error-patterns | Infra | 1h |

### 8.4 Fase 4 — Dashboard de Evolucao (1-2 semanas)

| # | Tarefa | Tipo | Esforco |
|---|--------|------|---------|
| F4.1 | Pagina `/ai-evolution` com graficos de evolucao | Frontend | 6h |
| F4.2 | Grafico de confidence media por semana (recharts) | Frontend | 2h |
| F4.3 | Tabela comparativa de agentes com metricas | Frontend | 3h |
| F4.4 | Card de "top erros recorrentes" | Frontend | 2h |
| F4.5 | Exportacao CSV/PDF das metricas | Frontend | 2h |

### Estimativa Total

| Fase | Esforco | Dependencias |
|------|---------|-------------|
| Fase 1 | ~10h | E16 D1 (critico) |
| Fase 2 | ~18h | Fase 1 |
| Fase 3 | ~18h | Fase 1 |
| Fase 4 | ~15h | Fases 1-3 |
| **Total** | **~61h** | |

---

## 9. Integracao com Sistema Existente

### 9.1 Conexao com Edge Functions Existentes

```
uazapi-webhook
  └→ process-incoming-message
       └→ agent-executor (gera resposta + confidence)
            ├→ learning-loop (feedback automatico)    ← JA EXISTE
            └→ extract-conversation-knowledge          ← JA EXISTE
                 └→ ai_knowledge_base (novos docs)

submit-feedback (NOVA)                                ← CRIAR
  ├→ ai_learning_feedback (registra)
  ├→ adjust_agent_confidence (RPC)                    ← JA EXISTE
  ├→ ai_knowledge_base (se correcao → novo doc)
  └→ learning-loop (re-processar com novo feedback)

detect-error-patterns (NOVA, cron semanal)            ← CRIAR
  ├→ ai_messages + ai_conversations (analise)
  ├→ ai_error_patterns (salvar padroes)
  └→ suggest-knowledge-doc (NOVA)                     ← CRIAR
       └→ ai_knowledge_base (status = 'draft')
```

### 9.2 Campos Novos Necessarios

**Tabela `ai_knowledge_base`:**
- `status TEXT DEFAULT 'published'` — valores: 'published', 'draft', 'archived'
- `suggested_by TEXT` — 'supervisor', 'auto_pattern', 'auto_extraction'

**Tabela `ai_learning_feedback`:**
- `reviewer_id UUID REFERENCES human_agents(id)` — quem revisou
- `review_notes TEXT` — notas opcionais do supervisor

---

## 10. Resumo e Proximos Passos

O sistema de feedback loop do Sismais Helpdesk IA ja possui uma base solida: a edge function `learning-loop` implementa feedback automatico por CSAT, escalacao e sentimento implicito; o `extract-conversation-knowledge` gera pares Q&A automaticamente; e o `evaluate-service` avalia qualidade com LLM. O que falta e:

1. **Ativar o pipeline em producao** (D1 do E16) — sem isso nada funciona
2. **Interface de supervisor** para feedback humano explicito — maior impacto na qualidade
3. **Deteccao de padroes** para identificar gaps na knowledge base proativamente
4. **Dashboard de evolucao** para acompanhar melhoria dos agentes ao longo do tempo

A prioridade absoluta e resolver o D1 (pipeline desconectado) e depois implementar a Fase 2 (interface de supervisor), que e o componente com maior ROI — cada correcao humana se torna um dado de treinamento permanente.

---

*Relatorio gerado em 2026-03-19. Revisao recomendada apos implementacao da Fase 1.*
