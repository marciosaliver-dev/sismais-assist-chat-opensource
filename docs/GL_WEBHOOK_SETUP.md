# Guia de Configuração do Webhook GL

## 1. Visão Geral

O sistema de sincronização de licenças do GL (Gestão Loja) funciona em **duas camadas**:

1. **Webhook em Tempo Real** - Captura mudanças de status instantaneamente quando ocorrem no GL
2. **Sincronização Periódica (pg_cron)** - Sincroniza a cada 5 minutos como fallback e reconciliação

### Arquitetura

```
┌─────────────┐
│  GL MySQL   │
└──────┬──────┘
       │
       ├─────────────────────┬─────────────────────┐
       │                     │                     │
       v                     v                     v
  [TRIGGER]          [pg_cron 5min]            [UPDATE direto]
       │                     │                     │
       └──────────┬──────────┴──────────┬──────────┘
                  │                     │
                  v                     v
    gl-status-webhook           gl-sync
    (Edge Function)          (Edge Function)
           │                        │
           └──────────┬────────────┘
                      │
                      v
              gl_client_licenses
              (Supabase Table)
                      │
                      v
                   Realtime
                      │
         ┌────────────┼────────────┐
         v            v            v
    Frontend      Agentes      Webhooks
```

**Fluxo:**
- GL MySQL → Trigger detecta mudança de `status_pessoa` → Insere na `webhook_queue`
- Processador lê `webhook_queue` → Chama `gl-status-webhook` com payload
- `gl-status-webhook` atualiza `gl_client_licenses` → Dispara Realtime
- Paralelamente: `pg_cron` (5 min) executa `gl-sync` para sincronização completa

---

## 2. Endpoint do Webhook

**URL:** `https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-status-webhook`

**Method:** `POST`

**Authentication:**
```
x-webhook-secret: <GL_WEBHOOK_SECRET>
```

O secret deve corresponder à variável de ambiente `GL_WEBHOOK_SECRET` configurada no Supabase.

---

## 3. Formato do Payload

### Estrutura JSON

```json
{
  "event": "status_changed",
  "data": {
    "gl_id": 12345,
    "source_system": "mais_simples",
    "status_pessoa": "Bloqueado",
    "nome": "Empresa XYZ",
    "cpf_cnpj": "12345678000190",
    "email": "contato@empresa.com",
    "telefone1": "11999998888",
    "celular": "11999998888"
  },
  "timestamp": "2026-04-03T12:00:00Z"
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `data.gl_id` | number | ID único do cliente no GL |
| `data.source_system` | string | Sistema origem (ex: `mais_simples`) |
| `event` | string | Tipo de evento (`status_changed`, `client_updated`, `client_created`) |

### Campos Recomendados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `data.status_pessoa` | string | Status atual (`Ativo`, `Bloqueado`, `Pendente`, etc) |
| `data.nome` | string | Nome/Razão social |
| `data.cpf_cnpj` | string | Documento sem máscaras |
| `data.email` | string | Email principal |
| `data.telefone1` | string | Telefone |
| `data.celular` | string | Celular/WhatsApp |

**Nota:** Incluir campos recomendados evita consultas round-trip ao MySQL do GL para enriquecer o registro.

### Tipos de Evento

- **`status_changed`** - Mudança de status de pessoa física/jurídica
- **`client_updated`** - Atualização geral de dados do cliente
- **`client_created`** - Novo cliente criado no GL

---

## 4. Resposta do Webhook

### Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Status updated",
  "data": {
    "gl_id": 12345,
    "updated_at": "2026-04-03T12:00:05.123Z",
    "status_pessoa": "Bloqueado"
  }
}
```

### Erro - Autenticação Inválida (401)

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing webhook secret"
}
```

### Erro - Payload Inválido (400)

```json
{
  "error": "Bad Request",
  "message": "Missing required field: data.gl_id",
  "details": {
    "missing_fields": ["data.gl_id"]
  }
}
```

### Erro - Servidor (500)

```json
{
  "error": "Internal Server Error",
  "message": "Failed to update gl_client_licenses",
  "requestId": "req_xyz123"
}
```

---

## 5. Implementação no GL

### Opção A: Trigger MySQL + Fila de Webhooks (Recomendado)

Esta abordagem é mais robusta, com retry automático e logging.

#### 5.1 Criar Tabela de Fila

```sql
CREATE TABLE webhook_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(50) NOT NULL,
  gl_id INT NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  error_message TEXT NULL,
  response_code INT NULL,
  INDEX idx_status_created (status, created_at),
  INDEX idx_gl_id (gl_id)
);
```

#### 5.2 Criar Trigger

```sql
DELIMITER $$

CREATE TRIGGER pessoas_status_change_trigger
AFTER UPDATE ON pessoas
FOR EACH ROW
BEGIN
  -- Apenas insere na fila se status mudou
  IF OLD.status_pessoa <> NEW.status_pessoa THEN
    INSERT INTO webhook_queue (
      event_type,
      gl_id,
      payload,
      created_at
    ) VALUES (
      'status_changed',
      NEW.id,
      JSON_OBJECT(
        'event', 'status_changed',
        'data', JSON_OBJECT(
          'gl_id', NEW.id,
          'source_system', 'mais_simples',
          'status_pessoa', NEW.status_pessoa,
          'nome', NEW.nome,
          'cpf_cnpj', NEW.cpf_cnpj,
          'email', NEW.email,
          'telefone1', NEW.telefone1,
          'celular', NEW.celular
        ),
        'timestamp', NOW()
      ),
      CURRENT_TIMESTAMP
    );
  END IF;
END$$

DELIMITER ;
```

#### 5.3 Script Processador (Bash + cURL)

Salve como `/scripts/process_webhook_queue.sh`:

```bash
#!/bin/bash

# Configurações
WEBHOOK_URL="https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-status-webhook"
GL_WEBHOOK_SECRET="${GL_WEBHOOK_SECRET:-seu_secret_aqui}"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS}"
DB_NAME="${DB_NAME:-gl_db}"
MAX_RETRIES=3
RETRY_DELAY=5  # segundos

# Log
LOG_FILE="/var/log/gl_webhook_processor.log"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Funcao para processar um item da fila
process_webhook() {
  local queue_id=$1
  local payload=$2

  log "Processando webhook queue_id=$queue_id"

  # Enviar webhook
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $GL_WEBHOOK_SECRET" \
    -d "$payload")

  # Parse response
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  log "Response: HTTP $http_code"

  # Atualizar status na fila
  if [ "$http_code" = "200" ]; then
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e \
      "UPDATE webhook_queue SET status='sent', sent_at=NOW(), response_code=$http_code WHERE id=$queue_id;"
    log "Webhook sent successfully (queue_id=$queue_id)"
    return 0
  else
    # Incrementar retry_count
    retry_count=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e \
      "SELECT retry_count FROM webhook_queue WHERE id=$queue_id;")
    new_retry=$((retry_count + 1))

    if [ $new_retry -lt $MAX_RETRIES ]; then
      log "Retry $new_retry/$MAX_RETRIES para queue_id=$queue_id (HTTP $http_code)"
      sleep $RETRY_DELAY
      mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e \
        "UPDATE webhook_queue SET retry_count=$new_retry, response_code=$http_code WHERE id=$queue_id;"
      return 1
    else
      log "Max retries exceeded para queue_id=$queue_id"
      mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e \
        "UPDATE webhook_queue SET status='failed', error_message='Max retries exceeded', response_code=$http_code WHERE id=$queue_id;"
      return 1
    fi
  fi
}

# Main loop
main() {
  log "Starting webhook processor..."

  # Processar itens pendentes
  while true; do
    # Buscar próximo item pendente (FIFO)
    result=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e \
      "SELECT id, payload FROM webhook_queue WHERE status='pending' ORDER BY created_at ASC LIMIT 1;")

    if [ -z "$result" ]; then
      # Nenhum item pendente, aguardar
      sleep 10
      continue
    fi

    queue_id=$(echo "$result" | awk '{print $1}')
    payload=$(echo "$result" | cut -f2-)

    process_webhook "$queue_id" "$payload"
  done
}

main
```

#### 5.4 Registrar como Cron Job

```bash
# Executar continuamente (recomendado usar supervisor ou systemd)
# Adicionar ao crontab para verificar a cada minuto:
* * * * * /scripts/process_webhook_queue.sh >> /var/log/gl_webhook_cron.log 2>&1
```

Ou usar supervisor para maior confiabilidade:

```ini
[program:gl_webhook_processor]
command=/scripts/process_webhook_queue.sh
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/gl_webhook_processor.log
```

---

### Opção B: Chamada Direta no Código (PHP/Laravel)

Se o GL possui camada web (PHP/Laravel), adicione a chamada ao webhook no código:

```php
<?php
// app/Models/Pessoa.php ou similar

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Client\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class Pessoa extends Model
{
    protected $table = 'pessoas';
    
    protected $fillable = [
        'nome',
        'status_pessoa',
        'cpf_cnpj',
        'email',
        'telefone1',
        'celular',
        // ... outros campos
    ];

    /**
     * Boot method - registrar observers para eventos
     */
    protected static function boot()
    {
        parent::boot();

        static::updating(function ($model) {
            // Se status mudou, enviar webhook
            if ($model->isDirty('status_pessoa')) {
                self::dispatchWebhook($model);
            }
        });

        static::created(function ($model) {
            // Novo cliente criado
            self::dispatchWebhook($model, 'client_created');
        });
    }

    /**
     * Disparar webhook para Supabase
     */
    protected static function dispatchWebhook($pessoa, $eventType = 'status_changed')
    {
        try {
            $secret = env('GL_WEBHOOK_SECRET');
            if (!$secret) {
                Log::warning('GL_WEBHOOK_SECRET não configurado');
                return;
            }

            $payload = [
                'event' => $eventType,
                'data' => [
                    'gl_id' => $pessoa->id,
                    'source_system' => 'mais_simples',
                    'status_pessoa' => $pessoa->status_pessoa,
                    'nome' => $pessoa->nome,
                    'cpf_cnpj' => $pessoa->cpf_cnpj,
                    'email' => $pessoa->email,
                    'telefone1' => $pessoa->telefone1,
                    'celular' => $pessoa->celular,
                ],
                'timestamp' => now()->toIso8601String(),
            ];

            $response = Http::withHeaders([
                'x-webhook-secret' => $secret,
                'Content-Type' => 'application/json',
            ])
            ->timeout(10)
            ->post(
                'https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-status-webhook',
                $payload
            );

            if ($response->successful()) {
                Log::info('Webhook enviado com sucesso', [
                    'gl_id' => $pessoa->id,
                    'event' => $eventType,
                ]);
            } else {
                Log::error('Falha ao enviar webhook', [
                    'gl_id' => $pessoa->id,
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Exceção ao enviar webhook', [
                'gl_id' => $pessoa->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
```

**Vantagens da Opção B:**
- Simples de implementar
- Sem dependência de scripts externos
- Sincronização imediata

**Desvantagens:**
- Sem retry automático se falhar
- Bloqueia a requisição (pode impactar performance)
- Sem fila de fallback

---

## 6. Configuração do Secret

### 6.1 Gerar Token Seguro

```bash
# Linux/macOS
openssl rand -hex 32
# Saída exemplo: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Windows (PowerShell)
-join ((0..63) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

### 6.2 Configurar no Supabase

```bash
# Via CLI
supabase secrets set GL_WEBHOOK_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"

# Ou via dashboard: Project Settings → Secrets → GL_WEBHOOK_SECRET
```

### 6.3 Configurar no Ambiente Local

```bash
# .env.local (desenvolvimento)
GL_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 6.4 Usar na Edge Function

```typescript
// supabase/functions/gl-status-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Validar secret
  const secret = Deno.env.get('GL_WEBHOOK_SECRET')
  const headerSecret = req.headers.get('x-webhook-secret')

  if (headerSecret !== secret) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ... resto da lógica
})
```

---

## 7. Monitoramento

### 7.1 Visualizar Logs do Webhook (Supabase)

```sql
SELECT 
  id,
  gl_id,
  event_type,
  status,
  response_code,
  error_message,
  received_at,
  processed_at
FROM gl_webhook_log
ORDER BY received_at DESC
LIMIT 50;
```

### 7.2 Verificar Fila (GL MySQL)

```sql
-- Itens pendentes
SELECT id, gl_id, event_type, created_at, retry_count
FROM webhook_queue
WHERE status = 'pending'
ORDER BY created_at ASC;

-- Itens com falha
SELECT id, gl_id, event_type, error_message, response_code, retry_count
FROM webhook_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

-- Estatísticas
SELECT 
  status,
  COUNT(*) as total,
  MAX(created_at) as last_item
FROM webhook_queue
GROUP BY status;
```

### 7.3 Dashboard de Health Check

```sql
-- Últimos 24 horas
SELECT 
  DATE(received_at) as date,
  COUNT(*) as total_webhooks,
  SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  ROUND(100.0 * SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM gl_webhook_log
WHERE received_at >= NOW() - INTERVAL 24 HOUR
GROUP BY DATE(received_at)
ORDER BY date DESC;
```

### 7.4 Alertas (Discord/Slack)

Configurar webhooks para alertar quando:
- Taxa de falha > 10% em 1 hora
- Fila pendente > 100 itens
- Tempo de processamento > 30s

---

## 8. Teste Manual

### 8.1 Teste com cURL

```bash
#!/bin/bash

# Configurações
WEBHOOK_URL="https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-status-webhook"
GL_WEBHOOK_SECRET="seu_secret_aqui"

# Payload de teste
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $GL_WEBHOOK_SECRET" \
  -d '{
    "event": "status_changed",
    "data": {
      "gl_id": 12345,
      "source_system": "mais_simples",
      "status_pessoa": "Bloqueado",
      "nome": "Empresa Teste XYZ",
      "cpf_cnpj": "12345678000190",
      "email": "contato@teste.com",
      "telefone1": "11999998888",
      "celular": "11999998888"
    },
    "timestamp": "2026-04-03T12:00:00Z"
  }'

echo ""
echo "Resposta esperada: { \"success\": true, \"message\": \"Status updated\", ... }"
```

### 8.2 Teste com Insomnia/Postman

1. **Criar requisição POST**
   - URL: `https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-status-webhook`
   - Method: `POST`

2. **Headers:**
   - `Content-Type: application/json`
   - `x-webhook-secret: seu_secret_aqui`

3. **Body (JSON):**
```json
{
  "event": "status_changed",
  "data": {
    "gl_id": 99999,
    "source_system": "mais_simples",
    "status_pessoa": "Ativo",
    "nome": "Empresa Teste",
    "cpf_cnpj": "12345678000190",
    "email": "test@example.com",
    "telefone1": "1133334444",
    "celular": "11988887777"
  },
  "timestamp": "2026-04-06T10:30:00Z"
}
```

4. **Enviar e validar resposta**

### 8.3 Teste de Segurança

Validar que endpoint rejeita:

```bash
# Sem header secret
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"event": "status_changed", ...}'
# Esperado: 401 Unauthorized

# Com secret incorreto
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: wrong_secret" \
  -d '{"event": "status_changed", ...}'
# Esperado: 401 Unauthorized

# Sem gl_id obrigatório
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: seu_secret_aqui" \
  -d '{"event": "status_changed", "data": {"source_system": "mais_simples"}}'
# Esperado: 400 Bad Request
```

---

## 9. Troubleshooting

### Problema: Webhook não chega

**Verificação:**
1. Confirmar que `GL_WEBHOOK_SECRET` está configurado no Supabase
2. Validar que URL está correta: `https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-status-webhook`
3. Testar conectividade: `curl -I https://pomueweeulenslxvsxar.supabase.co`
4. Validar que Edge Function está deployed e ativa
5. Checar logs do Supabase: Edge Functions → Logs

### Problema: 401 Unauthorized

**Causas possíveis:**
- Secret está incorreto
- Header `x-webhook-secret` não está sendo enviado
- Secret no Supabase diferente do que está sendo usado

**Solução:**
```bash
# Verificar secret configurado
supabase secrets list | grep GL_WEBHOOK_SECRET
```

### Problema: Payload rejeitado (400)

**Verificar:**
1. Se todos os campos obrigatórios estão presentes: `data.gl_id`, `data.source_system`
2. Se `gl_id` é número (não string)
3. Se `timestamp` está em formato ISO 8601 válido
4. Se JSON está bem-formado (validar em jsonlint.com)

### Problema: Fila cresce indefinidamente

**Diagnóstico:**
```sql
SELECT COUNT(*), status FROM webhook_queue GROUP BY status;
```

**Soluções:**
1. Verificar logs de erro: `error_message` na tabela `webhook_queue`
2. Confirmar que processador está em execução
3. Validar conectividade com Supabase (firewall/IP whitelist)
4. Aumentar timeout em `process_webhook_queue.sh` se response é lenta

---

## 10. Referências

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Webhook Best Practices](https://webhooks.fyi/)
- Projeto: `sismais-assist-chat`
- Edge Function: `gl-status-webhook`
- Tabela: `gl_client_licenses`, `gl_webhook_log`

---

**Última atualização:** 2026-04-06
**Versão:** 1.0
**Status:** Pronto para produção
