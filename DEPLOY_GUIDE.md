# 📋 GUIA DE DEPLOY - Sismais AI Tools

## Visão Geral

Este documento contém todas as instruções para deploy das melhorias do sistema Sismais AI Helpdesk.

---

## 🚀 Deploy Rápido

### 1. Deploy das Edge Functions

```bash
# Clone o repositório
git clone https://github.com/marciosaliver-dev/sismais-assist-chat.git
cd sismais-assist-chat

# Deploy de todas as funções
npx supabase functions deploy --all --project-ref pomueweeulenslxvsxar
```

Ou use o script PowerShell:

```powershell
.\scripts\deploy-ai-tools.ps1
```

### 2. Migrations (Executar no Supabase Dashboard)

Acesse: **Supabase Dashboard > SQL Editor**

Execute as migrations na seguinte ordem:

1. `supabase/migrations/20260214_add_ai_tools.sql`
2. `supabase/migrations/20260214_rag_feedback_loop.sql`
3. `supabase/migrations/20260215_register_ai_tools.sql`
4. `supabase/migrations/20260216_ai_tools_complete.sql`
5. `supabase/migrations/20260217_pg_cron_setup.sql` (CRON JOBS)
6. `supabase/migrations/20260218_ai_conversation_memory.sql` (MEMORY SYSTEM)
7. `supabase/migrations/20260403_ai_fine_tuning.sql` (FINE-TUNING)
8. `supabase/migrations/20260403_ai_predictive_routing.sql` (ROUTING)

### 3. Configurar Crons (Supabase Dashboard > Database > Extensions > pg_cron)

```sql
-- SLA Alerts a cada minuto
SELECT cron.schedule('sla-alert-check-every-minute', '*/1 * * * *', 
  $$SELECT net.http_post(url=>'https://pomueweeulenslxvsxar.supabase.co/functions/v1/sla-alert-check')$$);

-- Check de conversas inativas a cada 5 min
SELECT cron.schedule('check-inactive-conversations', '*/5 * * * *',
  $$SELECT net.http_post(url=>'https://pomueweeulenslxvsxar.supabase.co/functions/v1/check-inactive-conversations')$$);

-- Reconcile dead-letter a cada 10 min
SELECT cron.schedule('reconcile-messages', '*/10 * * * *',
  $$SELECT net.http_post(url=>'https://pomueweeulenslxvsxar.supabase.co/functions/v1/reconcile-messages')$$);

-- Proactive triggers a cada 15 min
SELECT cron.schedule('proactive-triggers', '*/15 * * * *',
  $$SELECT public.execute_proactive_triggers()$$);
```

---

## 📦 Edge Functions Deployadas

| Função | Propósito | Status |
|--------|-----------|--------|
| `kanban-create-ticket` | Criar tickets | ✅ Testado |
| `kanban-update-ticket` | Atualizar tickets | ✅ Criado |
| `escalate-to-human` | Transferir para humano | ✅ Testado |
| `create-reminder` | Criar lembretes | ✅ Testado |
| `schedule-callback` | Agendar retornos | ✅ Testado |
| `add-client-note` | Adicionar notas | ✅ Criado |
| `send-email` | Enviar emails | ✅ Criado |
| `knowledge-search` | Buscar KB | ✅ Criado |
| `process-proactive-trigger` | Triggers proativos | ✅ Criado |
| `ai-memory` | Gerenciamento de memória | ✅ Criado |
| `cto-advisor` | Conselheiro estratégico | ✅ Criado |
| `fine-tuning-loop` | Aprendizado contínuo | ✅ Deployado |
| `predictive-routing` | Roteamento inteligente | ✅ Deployado |

---

## 🛠️ Tools Disponíveis para Agentes

| Tool | Parâmetros | Uso |
|------|------------|-----|
| `kanban_create_ticket` | title, description, priority | Criar ticket |
| `kanban_update_ticket` | ticket_id, stage, notes | Mover ticket |
| `escalate_to_human` | conversation_id, reason | Escalar para humano |
| `create_reminder` | title, due_date, assign_to | Criar lembrete |
| `schedule_callback` | client_phone, scheduled_time | Agendar retorno |
| `add_client_note` | client_id, note, category | Anotar cliente |
| `send_email` | to, subject, body | Enviar email |
| `knowledge_search` | query, top_k | Buscar KB |

---

## 📊 Tabelas Criadas

| Tabela | Propósito |
|--------|-----------|
| `ai_reminders` | Lembretes de acompanhamento |
| `ai_callbacks` | Callbacks agendados |
| `ai_client_notes` | Anotações sobre clientes |
| `ai_actions_log` | Log de ações dos agentes |
| `ai_proactive_triggers` | Triggers proativos |
| `ai_conversation_memory` | Memória de conversas (contexto) |
| `ai_customer_memory` | Memória de longo prazo de clientes |
| `ai_session_context` | Contexto de sessão ativa |
| `ai_knowledge_graph` | Grafo de conhecimento |

---

## 🔄 Triggers Proativos Configurados

| Trigger | Condição | Ação |
|---------|----------|------|
| SLA Warning 80% | Ticket em espera 80% do SLA | Enviar mensagem |
| Client Inactivity 24h | Cliente sem resposta 24h | Enviar mensagem |
| Ticket Stale 7d | Ticket sem atividade 7 dias | Escalar |
| Churn Risk | Probabilidade > 70% | Agendar callback |

---

## 📈 Views Criadas

| View | Descrição |
|------|-----------|
| `ai_crm_metrics` | Métricas diárias de CRM |
| `ai_agent_performance` | Performance dos agentes |
| `knowledge_quality_report` | Qualidade da base de conhecimento |
| `ai_conversation_context` | Contexto combinado de conversação |
| `cron_job_status` | Status dos jobs cron |

## ⏰ Cron Jobs Configurados (via pg_cron_setup.sql)

| Job | Schedule | Função |
|-----|----------|--------|
| `sla-warning-check` | */15 * * * * | Verificar SLA em 80% |
| `sla-breach-check` | */5 * * * * | Verificar breach de SLA |
| `stale-ticket-check` | 0 */4 * * * | Detectar tickets parados |
| `client-inactivity-check` | 0 */2 * * * | Follow-up de inatividade |
| `callback-executor` | */5 * * * * | Executar callbacks |
| `reminder-executor` | */15 * * * * | Executar lembretes |
| `daily-reconciliation` | 0 0 * * * | Reconciliação diária |
| `weekly-report` | 0 6 * * 0 | Relatório semanal |
| `health-check` | */30 * * * * | Verificação de saúde |
| `unassigned-queue-check` | */10 * * * * | Tickets não atribuídos |

---

## 🧪 Testes

Execute os testes com:

```bash
# Teste manual de cada função
curl -X POST "https://pomueweeulenslxvsxar.supabase.co/functions/v1/kanban-create-ticket" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Teste","priority":"media"}'
```

---

## 🔧 Troubleshooting

### Erro 500 ao criar ticket
- Verifique se a migration foi executada
- Verifique se a tabela `ai_conversations` existe

### Circuit breaker aberto
- Aguarde 60 segundos (tempo de reset)
- Verifique logs da função

### Triggers não executam
- Verifique se pg_cron está ativo
- Verifique se as funções estão deployadas

---

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório GitHub.
