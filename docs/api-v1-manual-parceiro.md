# API Sismais Helpdesk — Manual do Parceiro

**Versao:** v1
**Base URL:** `https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1`

---

## Autenticacao

Todas as requisicoes (exceto `/health`) exigem uma API Key no header:

```
X-API-Key: sk_live_sua_chave_aqui
```

A chave e fornecida pelo administrador Sismais. Guarde-a em local seguro — ela nao pode ser recuperada apos a criacao.

---

## Rate Limits

Cada chave possui limites de requisicoes por minuto (RPM) e por dia (RPD), de acordo com o plano contratado:

| Plano | Req/minuto | Req/dia |
|-------|-----------|---------|
| Free | 30 | 1.000 |
| Starter | 60 | 10.000 |
| Pro | 120 | 50.000 |
| Enterprise | 300 | 200.000 |

Os headers de resposta informam seu consumo atual:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1711036800
```

Se exceder o limite, a API retorna `429 Too Many Requests`.

---

## Formato de Resposta

### Sucesso

```json
{
  "data": { ... }
}
```

### Sucesso com paginacao

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  }
}
```

### Erro

```json
{
  "error": {
    "message": "Descricao do erro",
    "code": "error_code",
    "status": 400
  }
}
```

---

## Paginacao

Endpoints que retornam listas aceitam os parametros:

| Parametro | Padrao | Max | Descricao |
|-----------|--------|-----|-----------|
| `page` | 1 | — | Numero da pagina |
| `per_page` | 20 | 100 | Itens por pagina |

Exemplo: `?page=2&per_page=50`

---

## Endpoints

### 1. Health Check

Verifica se a API esta disponivel. **Nao requer autenticacao.**

```
GET /health
```

**Resposta:**

```json
{
  "data": {
    "status": "ok",
    "version": "v1",
    "timestamp": "2026-03-19T15:30:00.000Z"
  }
}
```

---

### 2. Listar Conversas

Retorna as conversas de atendimento.

```
GET /conversations
```

**Parametros de query:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `status` | string | Filtrar por status: `open`, `in_progress`, `resolved`, `closed` |
| `page` | number | Pagina |
| `per_page` | number | Itens por pagina |

**Exemplo:**

```bash
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/conversations?status=open&page=1&per_page=10"
```

**Resposta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "customer_phone": "5511999999999",
      "status": "open",
      "handler_type": "ai",
      "agent_id": "uuid",
      "priority": "medium",
      "created_at": "2026-03-19T10:00:00Z",
      "updated_at": "2026-03-19T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 10,
    "total_pages": 5
  }
}
```

---

### 3. Detalhe da Conversa

Retorna uma conversa especifica com suas mensagens.

```
GET /conversations/{id}
```

**Exemplo:**

```bash
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/conversations/uuid-da-conversa"
```

**Resposta:**

```json
{
  "data": {
    "id": "uuid",
    "customer_phone": "5511999999999",
    "status": "open",
    "handler_type": "ai",
    "agent_id": "uuid",
    "priority": "medium",
    "summary": "Cliente com duvida sobre nota fiscal",
    "created_at": "2026-03-19T10:00:00Z",
    "updated_at": "2026-03-19T12:00:00Z",
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "Boa tarde, preciso de ajuda com uma NF-e",
        "confidence": null,
        "created_at": "2026-03-19T10:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "Boa tarde! Claro, posso ajudar. Qual o numero da nota?",
        "confidence": 0.92,
        "created_at": "2026-03-19T10:00:15Z"
      }
    ]
  }
}
```

> **Nota:** O campo `messages` retorna no maximo 100 mensagens por conversa, ordenadas da mais antiga para a mais recente.

---

### 4. Listar Tickets

Retorna tickets do Kanban (conversas vinculadas a um board).

```
GET /tickets
```

**Parametros de query:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `status` | string | Filtrar por status |
| `priority` | string | Filtrar por prioridade: `low`, `medium`, `high`, `urgent` |
| `page` | number | Pagina |
| `per_page` | number | Itens por pagina |

**Exemplo:**

```bash
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/tickets?priority=high&page=1"
```

**Resposta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "open",
      "priority": "high",
      "summary": "Erro ao emitir NF-e",
      "handler_type": "human",
      "kanban_board_id": "uuid",
      "kanban_stage_id": "uuid",
      "helpdesk_client_id": "uuid",
      "created_at": "2026-03-19T10:00:00Z",
      "updated_at": "2026-03-19T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

### 5. Listar Clientes

Retorna clientes cadastrados no helpdesk.

```
GET /clients
```

**Parametros de query:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `search` | string | Buscar por nome (parcial, case-insensitive) |
| `page` | number | Pagina |
| `per_page` | number | Itens por pagina |

**Exemplo:**

```bash
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/clients?search=empresa"
```

**Resposta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Empresa ABC Ltda",
      "documento": "12.345.678/0001-90",
      "email": "contato@empresaabc.com",
      "phone": "5511888888888",
      "status": "active",
      "health_score": 85,
      "created_at": "2026-01-15T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

## Codigos de Erro

| Codigo HTTP | Code | Descricao |
|-------------|------|-----------|
| 400 | `bad_request` | Parametros invalidos |
| 401 | `unauthorized` | API key ausente ou invalida |
| 403 | `forbidden` | Chave desativada, expirada ou sem permissao |
| 404 | `not_found` | Recurso nao encontrado |
| 429 | `rate_limit_exceeded` | Limite de requisicoes excedido |
| 500 | `internal_error` | Erro interno do servidor |
| 503 | `api_disabled` | API publica desabilitada |

---

## Exemplo Completo (cURL)

```bash
# 1. Verificar se a API esta no ar
curl https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/health

# 2. Listar tickets abertos com prioridade alta
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/tickets?status=open&priority=high"

# 3. Ver detalhe de uma conversa
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/conversations/ID_DA_CONVERSA"

# 4. Buscar clientes pelo nome
curl -H "X-API-Key: sk_live_sua_chave" \
  "https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1/clients?search=joao"
```

---

## Exemplo em JavaScript/Node.js

```javascript
const API_URL = 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1'
const API_KEY = 'sk_live_sua_chave'

async function getTickets(status, priority) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (priority) params.set('priority', priority)

  const response = await fetch(`${API_URL}/tickets?${params}`, {
    headers: { 'X-API-Key': API_KEY },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error.message)
  }

  return response.json()
}

// Uso
const result = await getTickets('open', 'high')
console.log(`Total de tickets: ${result.pagination.total}`)
result.data.forEach(t => console.log(`#${t.id} — ${t.summary}`))
```

---

## Exemplo em Python

```python
import requests

API_URL = 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/api-v1'
API_KEY = 'sk_live_sua_chave'

headers = {'X-API-Key': API_KEY}

# Listar tickets abertos
response = requests.get(f'{API_URL}/tickets', headers=headers, params={
    'status': 'open',
    'page': 1,
    'per_page': 50,
})

data = response.json()
print(f"Total: {data['pagination']['total']} tickets")

for ticket in data['data']:
    print(f"  [{ticket['priority']}] {ticket['summary']}")
```

---

## Suporte

Em caso de duvidas ou problemas com a API, entre em contato com o administrador que forneceu sua API Key.
