# GL ERP Real-Time Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar status de clientes do Sismais GL (MySQL) para o Supabase do sismais-assist-chat em tempo real, combinando sync periodico via pg_cron (consistencia) + webhook de trigger (tempo real).

**Architecture:** Duas camadas complementares: (1) pg_cron chama gl-sync a cada 5 minutos como safety net; (2) Uma nova Edge Function gl-status-webhook recebe notificacoes de mudanca do GL via HTTP POST e atualiza imediatamente o registro em gl_client_licenses. O GL precisa ser configurado para enviar um POST quando status_pessoa mudar. Adicionalmente, Supabase Realtime fica habilitado na tabela gl_client_licenses para que o frontend/agentes recebam mudancas instantaneamente.

**Tech Stack:** Supabase (pg_cron, pg_net, Edge Functions Deno, Realtime), MySQL (fonte GL)

---

## Arquivo de Referencia

| Arquivo | Papel |
|---------|-------|
| supabase/functions/gl-sync/index.ts | Sync batch existente (nao modificar) |
| supabase/functions/gl-sync-single/index.ts | Sync individual existente (reutilizar logica) |
| supabase/functions/gl-license-check/index.ts | Consulta de elegibilidade (nao modificar) |
| supabase/migrations/20260217_pg_cron_setup.sql | Cron jobs existentes (referencia de padrao) |

## File Structure

| Acao | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Create | supabase/migrations/20260403_gl_sync_cron.sql | Cron job para gl-sync a cada 5 min + Realtime na tabela |
| Create | supabase/functions/gl-status-webhook/index.ts | Recebe notificacoes de mudanca do GL em tempo real |
| Create | supabase/migrations/20260403_gl_webhook_log.sql | Tabela de auditoria de webhooks recebidos |
| Create | docs/GL_WEBHOOK_SETUP.md | Documentacao para configurar o lado GL |

---

### Task 1: Migration - pg_cron para gl-sync periodico + Realtime

**Files:**
- Create: supabase/migrations/20260403_gl_sync_cron.sql

- [ ] **Step 1: Criar a migration**

O conteudo da migration:

```sql
-- Migration: gl_sync_cron
-- Configura sync periodico do GL a cada 5 minutos e habilita Realtime

-- 1. Cron job: GL Sync incremental a cada 5 minutos
SELECT cron.schedule(
  'gl-sync-incremental',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-sync',
      body := '{"source": "both", "full_sync": false}'::jsonb,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY_PLACEHOLDER"}'::jsonb
    );
  $$
);

-- 2. Cron job: GL Full Sync diario as 3h da manha (safety net)
SELECT cron.schedule(
  'gl-sync-full-daily',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-sync',
      body := '{"source": "both", "full_sync": true}'::jsonb,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY_PLACEHOLDER"}'::jsonb
    );
  $$
);

-- 3. Habilitar Realtime na tabela gl_client_licenses
ALTER PUBLICATION supabase_realtime ADD TABLE gl_client_licenses;

-- 4. Indices para performance
CREATE INDEX IF NOT EXISTS idx_gl_client_licenses_synced_at
  ON gl_client_licenses (synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_gl_client_licenses_status
  ON gl_client_licenses (status_pessoa, support_eligible);

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260403_gl_sync_cron', 'GL sync cron jobs (5min incremental + daily full) and Realtime', NOW())
ON CONFLICT DO NOTHING;
```

IMPORTANTE: SERVICE_ROLE_KEY_PLACEHOLDER deve ser substituido pela service role key real antes de aplicar via SQL Editor. Nunca commitar a key real.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260403_gl_sync_cron.sql
git commit -m "feat(gl-sync): add pg_cron jobs for periodic GL sync and enable Realtime"
```

---

### Task 2: Edge Function - gl-status-webhook

Endpoint que o Sismais GL chama quando um status de cliente muda.

**Files:**
- Create: supabase/functions/gl-status-webhook/index.ts

- [ ] **Step 1: Criar a Edge Function**

A funcao recebe POST com dados da mudanca, autentica via x-webhook-secret, e faz upsert direto em gl_client_licenses. Se o payload for parcial (sem nome/status), chama gl-sync-single para buscar do MySQL.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/gl-status-webhook/index.ts
git commit -m "feat(gl-sync): add gl-status-webhook for real-time GL status notifications"
```

---

### Task 3: Migration - Tabela de log de webhooks

**Files:**
- Create: supabase/migrations/20260403_gl_webhook_log.sql

- [ ] **Step 1: Criar a migration**

Tabela gl_webhook_log com campos: id, event, gl_id, source_system, status_pessoa, previous_status, payload (jsonb), processing_method, success, error_message, received_at. Com indices em gl_id e received_at, e RLS para service_role only.

- [ ] **Step 2: Atualizar gl-status-webhook para logar na tabela**

Apos cada upsert ou sync-single, inserir registro em gl_webhook_log.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260403_gl_webhook_log.sql supabase/functions/gl-status-webhook/index.ts
git commit -m "feat(gl-sync): add webhook audit log table and logging"
```

---

### Task 4: Documentacao - Como configurar o lado GL

**Files:**
- Create: docs/GL_WEBHOOK_SETUP.md

- [ ] **Step 1: Criar documentacao**

Incluir: endpoint URL, autenticacao (x-webhook-secret header), formato do payload JSON, eventos suportados (status_changed, client_updated, client_created), exemplos de implementacao no GL (trigger MySQL + fila de webhook, ou chamada direta no codigo PHP/Node), e como monitorar via gl_webhook_log.

- [ ] **Step 2: Commit**

```bash
git add docs/GL_WEBHOOK_SETUP.md
git commit -m "docs: add GL webhook setup guide for real-time status sync"
```

---

### Task 5: Deploy e Teste End-to-End

- [ ] **Step 1: Configurar secret**

```bash
supabase secrets set GL_WEBHOOK_SECRET=<token-gerado-com-openssl-rand-hex-32>
```

- [ ] **Step 2: Deploy da Edge Function**

```bash
supabase functions deploy gl-status-webhook --no-verify-jwt
```

- [ ] **Step 3: Aplicar migrations via SQL Editor**

Executar 20260403_gl_sync_cron.sql (com key real) e 20260403_gl_webhook_log.sql.

- [ ] **Step 4: Verificar cron jobs**

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'gl-sync%';
```

- [ ] **Step 5: Testar webhook manualmente**

POST para gl-status-webhook com dados de teste, verificar resposta 200, registro em gl_client_licenses, e log em gl_webhook_log.

---

## Arquitetura Final

```
                    SISMAIS GL (MySQL)
                   Mais Simples + Maxpro
                          |
            +-------------+-------------+
            |                           |
     [TRIGGER] HTTP POST         [CRON] a cada 5 min
     quando status muda          pg_cron + pg_net
            |                           |
            v                           v
   gl-status-webhook            gl-sync (batch)
   (atualiza 1 registro)       (sync incremental)
            |                           |
            +-------------+-------------+
                          |
                          v
              gl_client_licenses (Supabase)
              + Realtime habilitado
                          |
            +-------------+-------------+
            |                           |
            v                           v
   gl-license-check            Frontend / Agentes IA
   (consulta status)           (via Supabase Realtime)
```
