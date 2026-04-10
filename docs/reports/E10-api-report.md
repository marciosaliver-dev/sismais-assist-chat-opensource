# E10 — Relatorio da API Publica REST v1

## Sismais Helpdesk IA

**Data:** 2026-03-19
**Autor:** Arquiteto de API Publica
**Branch:** main (1f83c32)
**Escopo:** Design, implementacao e documentacao da API REST publica v1

---

## 1. RESUMO

Implementacao completa da API REST publica versionada (`/api/v1/`) para integradores terceiros. Inclui autenticacao via API keys com hash SHA-256, rate limiting atomico por janela fixa (minuto + dia), webhooks de saida com assinatura HMAC-SHA256, e especificacao OpenAPI 3.1.

---

## 2. DESIGN DA API

### 2.1 Principios

- **Versionada**: Prefixo `/api/v1/` — novas versoes nao quebram integradores existentes
- **RESTful**: Recursos com substantivos, verbos HTTP corretos, paginacao consistente
- **Segura por padrao**: Feature flag `FF_PUBLIC_API` desativada por padrao (503 ate ativacao explicita)
- **Scoped**: Cada API key tem scopes granulares (ex: `messages:write`, `tickets:read`)
- **Rate limited**: Limites por minuto e por dia, com headers padrao na resposta

### 2.2 Endpoints

| Metodo | Path | Scope | Descricao |
|--------|------|-------|-----------|
| GET | `/health` | nenhum | Health check (sem auth) |
| POST | `/messages` | `messages:write` | Enviar mensagem em conversa |
| GET | `/conversations` | `conversations:read` | Listar conversas (paginado) |
| GET | `/conversations/:id` | `conversations:read` | Detalhe com mensagens |
| POST | `/tickets` | `tickets:write` | Criar ticket no Kanban |
| GET | `/tickets` | `tickets:read` | Listar tickets (paginado) |
| GET | `/clients` | `clients:read` | Listar clientes (paginado) |
| POST | `/webhooks` | `webhooks:write` | Registrar webhook de saida |
| GET | `/webhooks` | `webhooks:read` | Listar webhooks |
| DELETE | `/webhooks/:id` | `webhooks:write` | Remover webhook |

### 2.3 Formato de Resposta

**Sucesso:**
```json
{
  "data": { ... }
}
```

**Sucesso paginado:**
```json
{
  "data": [...],
  "pagination": { "total": 42, "page": 1, "per_page": 20, "total_pages": 3 }
}
```

**Erro:**
```json
{
  "error": {
    "message": "Descricao legivel",
    "code": "not_found",
    "status": 404
  }
}
```

---

## 3. MODELO DE AUTENTICACAO

### 3.1 API Keys

- Formato: `sk_live_<32chars>` (producao) ou `sk_test_<32chars>` (teste)
- Armazenamento: **apenas hash SHA-256** no banco — key em texto plano nunca e persistida
- Header: `X-API-Key: sk_live_abc123...`
- Prefixo visivel para identificacao no painel admin (ex: `sk_live_abc1...`)

### 3.2 Tabela `api_keys`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | uuid | PK |
| `name` | text | Nome descritivo |
| `key_hash` | text | SHA-256 hash (indice unico) |
| `key_prefix` | text | Primeiros 12 chars para display |
| `scopes` | text[] | Permissoes granulares |
| `rate_limit_rpm` | int | Requests por minuto |
| `rate_limit_rpd` | int | Requests por dia |
| `plan` | text | free / starter / pro / enterprise |
| `is_active` | bool | Permite desativar sem deletar |
| `expires_at` | timestamptz | Expiracao opcional |

### 3.3 Scopes Disponiveis

| Scope | Descricao |
|-------|-----------|
| `*` | Acesso total (uso interno) |
| `messages:write` | Enviar mensagens |
| `conversations:read` | Ler conversas e mensagens |
| `tickets:read` | Ler tickets |
| `tickets:write` | Criar tickets |
| `clients:read` | Ler clientes |
| `webhooks:read` | Ler webhooks registrados |
| `webhooks:write` | Criar/deletar webhooks |

### 3.4 Planos e Limites

| Plano | RPM | RPD | Scopes |
|-------|-----|-----|--------|
| free | 60 | 10.000 | Todos exceto `messages:write` |
| starter | 120 | 50.000 | Todos |
| pro | 300 | 100.000 | Todos |
| enterprise | 1.000 | 500.000 | Todos + SLA |

---

## 4. RATE LIMITING

### 4.1 Mecanismo

- **Janela fixa** por minuto (`date_trunc('minute', now())`) e por dia (`date_trunc('day', now())`)
- **Atomico**: Funcao SQL `check_api_rate_limit()` faz INSERT ON CONFLICT UPDATE atomicamente
- **Tabela**: `api_rate_limits` com cleanup automatico (registros > 2 dias)
- **Headers de resposta**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (quando 429)

### 4.2 Comportamento

1. Request chega -> autentica API key
2. Chama `check_api_rate_limit` para janela de minuto
3. Se excedeu, retorna 429 com `Retry-After`
4. Chama `check_api_rate_limit` para janela de dia
5. Se excedeu, retorna 429 com `Retry-After`
6. Processa request normalmente

---

## 5. WEBHOOKS DE SAIDA

### 5.1 Eventos Suportados

| Evento | Trigger |
|--------|---------|
| `ticket.created` | Ticket criado via API |
| `ticket.updated` | Ticket movido no Kanban (futuro) |
| `message.received` | Mensagem recebida do WhatsApp (futuro) |
| `message.sent` | Mensagem enviada via API |
| `conversation.escalated` | Conversa escalada para humano (futuro) |
| `conversation.closed` | Conversa fechada (futuro) |

### 5.2 Payload

```json
{
  "event": "ticket.created",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "data": { ... }
}
```

### 5.3 Seguranca

- Assinatura HMAC-SHA256 do body no header `X-Sismais-Signature: sha256=<hex>`
- Secret unico por webhook, gerado na criacao (mostrado apenas uma vez)
- Verificacao no integrador:
```python
import hmac, hashlib
expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
assert header_signature == f"sha256={expected}"
```

### 5.4 Resiliencia

- Timeout de 10s por entrega
- Falhas consecutivas contadas (`failure_count`)
- Apos 10 falhas consecutivas (configuravel `max_failures`), webhook desativado automaticamente
- Log de todas as entregas em `api_webhook_deliveries` (retencao: 30 dias)

---

## 6. ARQUIVOS CRIADOS

### Migration
- `supabase/migrations/20260319200000_api_keys_and_webhooks.sql` — Tabelas `api_keys`, `api_rate_limits`, `api_webhooks`, `api_webhook_deliveries` + funcoes SQL

### Shared Modules
- `supabase/functions/_shared/api-auth.ts` — Autenticacao via API key (hash, validacao, geracao)
- `supabase/functions/_shared/api-rate-limit.ts` — Rate limiting com headers
- `supabase/functions/_shared/api-response.ts` — Formatacao de respostas (success, error, paginated)
- `supabase/functions/_shared/api-webhook-dispatcher.ts` — Disparo de webhooks com HMAC e retry

### Edge Function
- `supabase/functions/api-v1/index.ts` — Router principal com todos os handlers

### Documentacao
- `docs/openapi-v1.yaml` — Especificacao OpenAPI 3.1 completa

### Feature Flag
- `FF_PUBLIC_API` adicionada em `_shared/feature-flags.ts` — desativada por padrao

---

## 7. SEGURANCA (referencia E03)

| Vulnerabilidade E03 | Mitigacao na API |
|---------------------|-----------------|
| V-002 (endpoints sem auth) | API key obrigatoria em todos os endpoints (exceto /health) |
| V-005 (sem rate limiting) | Rate limiting atomico por minuto e dia |
| V-006 (webhooks sem verificacao) | HMAC-SHA256 em todos os webhooks de saida |
| V-009 (sem rate limiting global) | Headers padrao X-RateLimit-* |
| V-011 (erros internos expostos) | Mensagens genericas para o cliente, log interno detalhado |
| V-016 (sem validacao de input) | Validacao de formato de API key, URL, eventos |

### RLS

Todas as 4 tabelas novas tem RLS habilitado:
- `api_keys`: apenas admins aprovados podem acessar via frontend
- `api_rate_limits`, `api_webhooks`, `api_webhook_deliveries`: apenas service_role

---

## 8. PROXIMOS PASSOS

1. **UI de gestao de API keys** — Pagina `/admin/api-keys` para criar/revogar keys
2. **Integrar webhooks ao pipeline existente** — Disparar `message.received` no `process-incoming-message` e `conversation.escalated` no orchestrator
3. **Swagger UI** — Endpoint `/api/v1/docs` com interface interativa
4. **SDK clients** — Gerar SDKs em Python e Node.js a partir do OpenAPI spec
5. **Testes de carga** — Validar rate limiting sob stress
6. **Audit trail** — Logar todas as chamadas de API em tabela dedicada
