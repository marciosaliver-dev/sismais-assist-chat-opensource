# E11 — CRM 360: Modelo de Dados Unificado

**Data:** 2026-03-19
**Autor:** Arquiteto CRM 360
**Escopo:** Visao unificada do cliente em todos os canais e sistemas
**Dependencias:** E16 (CTO Report), E17 (CPO Report), E04 (Agentes)

---

## 1. Diagnostico do Estado Atual

### 1.1 Fontes de Dados

| Fonte | Tabela/Servico | Dados | Status |
|-------|---------------|-------|--------|
| Helpdesk local | `helpdesk_clients` | Nome, CNPJ, CPF, telefone, email, sistema, produto | Ativo, schema basico |
| Helpdesk local | `helpdesk_client_contacts` | Contatos associados ao cliente | Ativo |
| Helpdesk local | `helpdesk_client_contracts` | Contratos manuais | Ativo |
| Sismais GL (ERP) | `sismais-client-lookup` (edge fn) | Dados cadastrais, telefone, documento | Ativo, cache via `customer_profiles` |
| Sismais Admin | `sismais-admin-proxy` + `sync-sismais-admin-clients` | Contratos, faturas, MRR, divida | Ativo, sync incremental |
| WhatsApp/UAZAPI | `uazapi_chats`, `customer_profiles` | Nome, avatar, status WhatsApp | Ativo, enrichment via `enrich-contact` |
| Atendimento | `ai_conversations`, `ai_messages` | Historico de conversas, CSAT | Ativo |
| Health Score | `customer_health_scores` | Score calculado por telefone | Ativo, desvinculado de `helpdesk_clients` |

### 1.2 Problemas Identificados

**P1 — Dados fragmentados sem chave unificadora**
`helpdesk_clients` nao tem campos suficientes para ser o hub central. Campos como `lifecycle_stage`, `health_score`, `engagement_score`, `customer_tier` nao existem na tabela. O `customer_health_scores` usa `customer_phone` como chave primaria, desvinculado de `helpdesk_clients.id`.

**P2 — Sem timeline unificada**
Interacoes do cliente estao espalhadas em `ai_conversations`, `ai_messages`, `uazapi_messages`, `helpdesk_client_annotations`. Nao ha uma visao cronologica consolidada.

**P3 — Sem deteccao de duplicatas**
O `sismais-client-auto-link` cria registros em `helpdesk_clients` ao vincular clientes do Sismais Admin, mas pode criar duplicatas quando o mesmo cliente chega por canais diferentes (telefone diferente, CNPJ via sync).

**P4 — Customer 360 edge function limitada**
A funcao atual retorna dados basicos mas:
- Nao busca por documento/CNPJ
- Nao inclui timeline unificada
- Nao calcula scores em tempo real
- Nao retorna dados de fontes externas
- Nao suporta parametros opcionais (timeline, scores)

**P5 — Scoring desvinculado**
`customer_health_scores` usa telefone como chave, sem FK para `helpdesk_clients`. O scoring nao e usado pelos agentes IA em tempo real.

---

## 2. Modelo de Dados Unificado

### 2.1 Decisao de Arquitetura: `helpdesk_clients` como Hub Central

Em vez de criar uma nova tabela `crm_unified_clients`, estendemos `helpdesk_clients` com campos adicionais. Justificativa:
- Ja tem 10+ edge functions e paginas React que referenciam `helpdesk_clients`
- FK existente em `ai_conversations.helpdesk_client_id`
- Evita migracao massiva de dados

### 2.2 Novos Campos em `helpdesk_clients`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `lifecycle_stage` | text | prospect, onboarding, active, at_risk, churned |
| `customer_since` | timestamptz | Data de inicio como cliente |
| `segment` | text | Segmento de mercado |
| `nps_score` | integer | Ultimo NPS |
| `mrr` / `mrr_total` | numeric(12,2) | Receita recorrente mensal |
| `debt_total` | numeric(12,2) | Divida total vencida |
| `pending_invoices_count` | integer | Faturas pendentes |
| `active_contracts_count` | integer | Contratos ativos |
| `license_status` | text | active, cancelled, expired, unknown |
| `customer_tier` | text | starter, business, enterprise |
| `plan_level` | text | Basico, Profissional, Enterprise |
| `churn_risk` | boolean | Risco de cancelamento |
| `sismais_admin_id` | text | ID no Sismais Admin (documento) |
| `sismais_gl_id` | text | ID no Sismais GL (ERP) |
| `health_score` | integer | Score de saude 0-100 |
| `engagement_score` | integer | Score de engajamento 0-100 |
| `scores_updated_at` | timestamptz | Ultima atualizacao de scores |
| `avatar_url` | text | Foto (WhatsApp ou manual) |
| `merged_into_id` | uuid FK | Se foi mesclado, aponta para o registro mantido |
| `is_merged` | boolean | Flag de registro mesclado |
| `last_synced_at` | timestamptz | Ultima sincronizacao com fontes externas |

### 2.3 Novas Tabelas

#### `crm_timeline` — Timeline Unificada
Registro cronologico de TODAS as interacoes do cliente em todos os canais.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | uuid PK | |
| `client_id` | uuid FK | Referencia `helpdesk_clients` |
| `event_type` | text | message, ticket_created, ticket_resolved, contract_change, annotation, payment, system |
| `channel` | text | whatsapp, web, phone, email, instagram, internal |
| `title` | text | Descricao curta do evento |
| `description` | text | Detalhes |
| `metadata` | jsonb | Dados extras especificos do tipo |
| `conversation_id` | uuid | Referencia cruzada |
| `actor_type` | text | client, ai_agent, human_agent, system |
| `actor_name` | text | Nome do ator |
| `occurred_at` | timestamptz | Quando ocorreu |

#### `crm_duplicate_candidates` — Deteccao de Duplicatas
Pares de clientes potencialmente duplicados.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `client_a_id` / `client_b_id` | uuid FK | Par de clientes |
| `match_score` | numeric | 0-100, confianca da correspondencia |
| `match_reasons` | jsonb | Campos que corresponderam |
| `status` | text | pending, confirmed, rejected, merged |

#### `crm_score_history` — Historico de Scores
Evolucao temporal dos scores para analytics e tendencias.

#### `crm_data_sources` — Registro de Fontes
Rastreia quais sistemas alimentam cada cliente e quando foi a ultima sincronizacao.

### 2.4 Diagrama ER Simplificado

```
helpdesk_clients (hub central)
├── helpdesk_client_contacts (1:N)
├── helpdesk_client_contracts (1:N)
├── helpdesk_client_annotations (1:N)
├── ai_conversations (1:N via helpdesk_client_id)
│   └── ai_messages (1:N)
├── crm_timeline (1:N) [NOVO]
├── crm_data_sources (1:N) [NOVO]
├── crm_score_history (1:N) [NOVO]
└── crm_duplicate_candidates (N:M) [NOVO]

customer_profiles (cache WhatsApp, vinculado por phone)
customer_health_scores (legado, vinculado por phone)
```

---

## 3. Timeline Unificada

### 3.1 Tipos de Evento

| Tipo | Origem | Descricao |
|------|--------|-----------|
| `message_received` | uazapi-webhook | Cliente enviou mensagem WhatsApp |
| `message_sent` | agent-executor / humano | Resposta enviada ao cliente |
| `ticket_created` | process-incoming-message | Nova conversa/ticket aberto |
| `ticket_resolved` | agente / auto | Conversa finalizada |
| `ticket_escalated` | orchestrator | Escalado para humano |
| `contract_created` | sync / manual | Novo contrato |
| `contract_cancelled` | sync | Contrato cancelado |
| `payment_received` | sismais-admin-proxy | Pagamento confirmado |
| `payment_overdue` | sla-alert-check | Fatura vencida |
| `annotation_added` | manual | Anotacao do agente |
| `client_linked` | sismais-client-auto-link | Cliente vinculado automaticamente |
| `score_changed` | calculate-health-scores | Score de saude mudou |
| `csat_received` | avaliacao | Cliente avaliou atendimento |

### 3.2 Populacao da Timeline

A timeline sera populada por:
1. **Trigger no banco** — INSERT em `ai_conversations` e `ai_messages` gera evento na timeline (futuro)
2. **Edge functions** — Ao final de cada operacao significativa, inserir evento
3. **Backfill** — Script unico para popular timeline com dados historicos de `ai_conversations`

### 3.3 Acesso pela IA

Agentes IA acessam a timeline via `customer-360` com `include_timeline: true`. O system prompt do agente recebe um resumo:

```
Contexto do cliente:
- Ultima interacao: 2 dias atras
- 15 interacoes nos ultimos 30 dias
- CSAT medio: 4.2
- Contrato ativo: GMS Web (R$ 350/mes)
- Ultimo evento: Pagamento recebido (ontem)
```

---

## 4. Scoring de Cliente

### 4.1 Health Score (0-100)

Combinacao ponderada de 5 fatores:

| Fator | Peso | Calculo |
|-------|------|---------|
| Recencia | 25% | 100 - (dias desde ultima interacao * 2), min 0 |
| Frequencia | 20% | min(100, mensagens_30d * 5) |
| CSAT | 25% | avg_csat * 20 |
| Financeiro | 20% | 100 se sem divida, 50 se divida < MRR, 0 se divida > MRR |
| Contrato | 10% | 100 se ativo, 50 se proximo do vencimento, 0 se cancelado |

### 4.2 Engagement Score (0-100)

Calculado em tempo real pelo `customer-360` quando score tem mais de 24h:

| Fator | Peso |
|-------|------|
| Recencia | 30% |
| Frequencia (msgs 30d) | 25% |
| CSAT | 25% |
| Contratos ativos | 20% |

### 4.3 Churn Risk

Booleano derivado de:
- `debt_total > 0` (faturas vencidas)
- `health_score < 40`
- `days_since_last_interaction > 30` com contrato ativo
- Contrato vencendo em < 15 dias sem renovacao

### 4.4 Customer Tier (derivado de MRR)

| MRR | Tier |
|-----|------|
| > R$ 500 | Enterprise |
| > R$ 200 | Business |
| <= R$ 200 | Starter |

---

## 5. Deteccao e Merge de Duplicatas

### 5.1 Criterios de Match

| Campo | Tipo de Match | Score |
|-------|--------------|-------|
| CNPJ | Exato | 95 |
| Email | Exato (case-insensitive) | 85 |
| Telefone | Ultimos 8 digitos | 80 |
| Nome + CNPJ parcial | Fuzzy | 60 |

### 5.2 Fluxo de Merge

```
1. crm_detect_duplicates() — Roda periodicamente, insere em crm_duplicate_candidates
2. UI mostra lista de candidatos com match_score e razoes
3. Agente humano confirma ou rejeita
4. Se confirmado: crm_merge_clients(keep_id, merge_id)
   - Move contatos, contratos, anotacoes, conversas, timeline
   - Marca registro merged como is_merged=true
   - Preserva merged_into_id para redirect
```

### 5.3 Funcoes SQL Criadas

- `crm_search_client(phone, documento, email, name)` — Busca unificada usada pelos agentes IA
- `crm_detect_duplicates(limit)` — Detecta e registra duplicatas
- `crm_merge_clients(keep_id, merge_id, resolved_by)` — Executa merge

---

## 6. Edge Function `customer-360` v2

### 6.1 Melhorias vs v1

| Aspecto | v1 | v2 |
|---------|----|----|
| Busca | client_id, phone, email | + documento, RPC unificado |
| Timeline | Nao | Sim, opcional |
| Scores | Leitura de `customer_health_scores` | Calculo em tempo real + historico |
| WhatsApp | Nao | Sim, avatar e dados |
| Data sources | Nao | Sim, rastreabilidade |
| Parametros | Fixos | Opcionais (timeline, scores, whatsapp) |
| Logs | console.log texto | JSON estruturado |
| Fallback | 404 se nao achar | Retorna dados parciais do WhatsApp |

### 6.2 Formato de Resposta

```json
{
  "client": { "...campos helpdesk_clients...", "contacts": [...] },
  "contracts": { "all": [...], "active_count": 2, "nearest_renewal": {...}, "total_mrr": 450 },
  "annotations": [...],
  "health": { "score": 72, "engagement_score": 65, "churn_risk": false, "debt_total": 0 },
  "conversations": { "recent": [...], "total": 15, "resolved": 12, "ai_resolved": 8, "open": 1, "avg_csat": 4.2 },
  "activity": { "last_interaction": "...", "days_since_last_interaction": 2, "messages_last_30_days": 45 },
  "lifecycle": { "stage": "active", "customer_since": "...", "tier": "business", "mrr": 350 },
  "data_sources": [{ "system": "sismais_admin", "synced_at": "..." }],
  "timeline": [...],
  "whatsapp": { "name": "Joao", "avatar_url": "..." }
}
```

---

## 7. Acesso pelos Agentes IA em Tempo Real

### 7.1 Fluxo

```
Cliente envia msg WhatsApp
  -> uazapi-webhook (salva msg)
  -> process-incoming-message
     -> sismais-client-auto-link (vincula client_id)
     -> message-analyzer (intent, sentiment)
     -> orchestrator (escolhe agente)
     -> agent-executor
        -> customer-360 (busca dados do cliente)  <-- AQUI
        -> Dados injetados no system prompt do agente
        -> LLM gera resposta com contexto do cliente
```

### 7.2 Dados Injetados no System Prompt

O `agent-executor` chama `customer-360` com `{ phone: customer_phone, include_timeline: false }` e injeta um resumo compacto:

```
[CONTEXTO DO CLIENTE]
Nome: Empresa XYZ (CNPJ: 12.345.678/0001-00)
Tier: Business | Plano: GMS Web | MRR: R$ 350
Status: Ativo desde 15/03/2024
Health: 72/100 | Engajamento: 65/100
Contratos ativos: 2 | Renovacao em 45 dias
Divida: R$ 0 | CSAT medio: 4.2
Ultima interacao: 2 dias atras
Total de atendimentos: 15 (8 resolvidos por IA)
```

### 7.3 Performance

- `customer-360` usa `Promise.all` para 7+ queries em paralelo
- Resposta tipica: < 300ms (dados locais)
- Score recalculado apenas se > 24h de idade
- Timeline opcional (agentes nao precisam sempre)

---

## 8. Plano de Migracao

### Fase 1 — Schema (imediato)

- [x] Migration SQL criada: `20260319130000_crm360_unified_model.sql`
  - Campos novos em `helpdesk_clients` (com IF NOT EXISTS)
  - Tabelas novas: `crm_timeline`, `crm_duplicate_candidates`, `crm_score_history`, `crm_data_sources`
  - Funcoes RPC: `crm_search_client`, `crm_detect_duplicates`, `crm_merge_clients`
  - Indices para busca e deduplicacao
  - RLS com politicas

### Fase 2 — Edge Function (imediato)

- [x] `customer-360` v2 otimizada
  - Busca por documento
  - RPC unificado
  - Timeline e scores opcionais
  - Dados WhatsApp
  - Engagement score em tempo real
  - Logs JSON estruturados

### Fase 3 — Populacao de Timeline (semana 2)

- [ ] Backfill: script para popular `crm_timeline` com dados de `ai_conversations` existentes
- [ ] Modificar `sismais-client-auto-link` para inserir evento na timeline ao vincular
- [ ] Modificar `process-incoming-message` para inserir evento ao criar/resolver ticket
- [ ] Modificar `sync-sismais-admin-clients` para inserir evento ao detectar mudanca de contrato

### Fase 4 — Scoring Integrado (semana 3)

- [ ] Migrar `customer_health_scores` para usar `helpdesk_clients.id` como FK
- [ ] Modificar `calculate-health-scores` para atualizar `helpdesk_clients.health_score`
- [ ] Adicionar score history em `crm_score_history`
- [ ] Dashboard de evolucao de scores na UI

### Fase 5 — Deduplicacao (semana 4)

- [ ] Rodar `crm_detect_duplicates()` em batch (via cron ou manual)
- [ ] UI para revisar e confirmar/rejeitar duplicatas
- [ ] Botao de merge manual na pagina de cliente

### Fase 6 — Agent Integration (semana 4-5)

- [ ] Modificar `agent-executor` para chamar `customer-360` e injetar contexto
- [ ] Adicionar `crm_search_client` como tool disponivel para agentes
- [ ] Testar com agentes LINO, KIRA e KITANA

---

## 9. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migration falha em prod | Alto | Todos os ALTER TABLE usam IF NOT EXISTS |
| Performance do customer-360 | Medio | Promise.all paralelo, scores cacheados 24h |
| Merge incorreto de clientes | Alto | Requer confirmacao humana, auditavel via crm_duplicate_candidates |
| Dados desatualizados entre fontes | Medio | crm_data_sources rastreia sync_status, alertas para stale |
| Timeline cresce muito rapido | Baixo | Apenas eventos significativos, nao cada mensagem individual |

---

## 10. Resumo Executivo

O CRM 360 transforma `helpdesk_clients` de uma tabela de cadastro basico em um hub unificado com:

1. **Dados de 4 fontes** consolidados em um unico registro
2. **Timeline unificada** de todas as interacoes em todos os canais
3. **Scoring em tempo real** (health, engagement, churn risk) calculado pelo customer-360
4. **Deteccao automatica de duplicatas** com merge auditavel
5. **Acesso pelos agentes IA** via RPC e customer-360, com contexto injetado no prompt

Os entregaveis imediatos (migration + edge function) estao prontos para deploy. As fases 3-6 sao incrementais e podem ser executadas sem quebrar funcionalidade existente.

---

*Relatorio gerado em 2026-03-19.*
