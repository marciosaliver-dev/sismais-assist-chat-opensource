# UAZAPI Integration Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 5 problemas reportados por usuarios (latencia de recebimento, imagens nao carregando, demora no envio, suporte a grupos, agente de grupo) e implementar fila persistente de midia.

**Architecture:** Separar o download de midia do webhook principal numa fila persistente (tabela `media_download_queue`), adicionar suporte first-class a grupos com campo `is_group` + `group_name` em `ai_conversations`, e criar agente especialista em grupos. O webhook continua sincrono mas pula o download de midia (delega para fila), reduzindo latencia drasticamente. A fila e processada por `media-worker` acionado via fire-and-forget e pg_cron (1min).

**Nota:** `ai_messages.media_url` e `ai_messages.media_type` ja existem no schema atual. `uazapi_chats.is_group` tambem ja existe. As migrations sao aditivas (ADD COLUMN IF NOT EXISTS).

**Tech Stack:** Supabase (PostgreSQL + Edge Functions + Storage + Realtime), React + TypeScript, TanStack Query, UAZAPI API v2

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/functions/media-worker/index.ts` | Edge function que processa itens da fila de midia |
| `src/components/inbox/GroupBadge.tsx` | Badge visual "Grupo" para conversas de grupo |
| `src/components/inbox/GroupSenderName.tsx` | Nome do remetente individual em mensagens de grupo |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | Extrair download de midia para fila; melhorar deteccao de grupo; salvar `is_group`/`group_name` |
| `supabase/functions/uazapi-proxy/index.ts` | Adicionar action `processMediaQueue` para trigger manual |
| `supabase/functions/process-incoming-message/index.ts` | Rotear mensagens de grupo para agente de grupo |
| `supabase/functions/orchestrator/index.ts` | Adicionar logica de roteamento para grupos |
| `supabase/functions/_shared/uazapi-adapter.ts` | Extrair metadata de grupo (nome, participantes) |
| `src/components/inbox/ChatArea.tsx` | Exibir badge de grupo + nome do remetente por mensagem |
| `src/hooks/useConversationMessages.ts` | Subscrever a updates de `media_url` da fila |
| `src/hooks/useInboxConversations.ts` | Filtro/indicador visual para grupos |

---

## Phase 1: Fila Persistente de Midia (Resolve problemas 2 e 3)

### Task 1: Migration — tabela `media_download_queue`

**Files:**
- Create: SQL migration via Supabase MCP

- [ ] **Step 1: Criar migration para tabela `media_download_queue`**

```sql
-- Migration: create media_download_queue table
CREATE TABLE public.media_download_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  instance_id UUID REFERENCES public.uazapi_instances(id),
  uazapi_message_db_id UUID,
  ai_message_id UUID,
  conversation_id UUID,
  media_url_source TEXT NOT NULL,
  media_key TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  mimetype TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  storage_path TEXT,
  signed_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

CREATE INDEX idx_media_queue_status ON public.media_download_queue(status, next_retry_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_media_queue_message ON public.media_download_queue(message_id);
CREATE INDEX idx_media_queue_conversation ON public.media_download_queue(conversation_id);

ALTER TABLE public.media_download_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on media_download_queue"
  ON public.media_download_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read media_download_queue"
  ON public.media_download_queue FOR SELECT
  USING (auth.role() = 'authenticated');
```

- [ ] **Step 2: Aplicar migration via Supabase MCP**

Run: `mcp__claude_ai_Supabase__apply_migration` com o SQL acima.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add media_download_queue table for async media processing"
```

---

### Task 2: Migration — adicionar campos de grupo em `ai_conversations`

**Files:**
- Create: SQL migration via Supabase MCP

- [ ] **Step 1: Criar migration para campos de grupo**

```sql
-- Migration: add group support fields to ai_conversations
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS group_jid TEXT;

-- Add sender_name to ai_messages for group context
ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- Index for group filtering
CREATE INDEX idx_conversations_is_group ON public.ai_conversations(is_group)
  WHERE is_group = true;
```

- [ ] **Step 2: Aplicar migration via Supabase MCP**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add is_group, group_name fields to ai_conversations and sender fields to ai_messages"
```

---

### Task 3: Edge Function — `media-worker`

**Files:**
- Create: `supabase/functions/media-worker/index.ts`

- [ ] **Step 1: Criar edge function `media-worker`**

```typescript
// supabase/functions/media-worker/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BATCH_SIZE = 10;
const RETRY_DELAYS = [0, 5_000, 15_000, 60_000, 300_000]; // 0s, 5s, 15s, 1m, 5m

// Magic bytes for media validation
const MAGIC_BYTES: Record<string, number[][]> = {
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  gif: [[0x47, 0x49, 0x46]],
  mp4: [], // checked by ftyp at offset 4
  ogg: [[0x4F, 0x67, 0x67, 0x53]],
  pdf: [[0x25, 0x50, 0x44, 0x46]],
};

function isValidMedia(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  // Reject HTML error pages
  const textStart = new TextDecoder().decode(buffer.slice(0, 50)).toLowerCase();
  if (textStart.includes("<!doctype") || textStart.includes("<html")) return false;
  // Check known magic bytes
  for (const patterns of Object.values(MAGIC_BYTES)) {
    for (const pattern of patterns) {
      if (pattern.every((b, i) => buffer[i] === b)) return true;
    }
  }
  // MP4: check ftyp at offset 4
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  // Accept if > 1KB and not HTML (heuristic for unknown formats)
  return buffer.length > 1024;
}

function getExtension(mimetype: string | null, mediaType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
    "application/pdf": "pdf", "audio/mp4": "m4a",
  };
  if (mimetype && map[mimetype]) return map[mimetype];
  const typeMap: Record<string, string> = {
    image: "jpg", video: "mp4", audio: "ogg", document: "bin", sticker: "webp", ptt: "ogg",
  };
  return typeMap[mediaType] || "bin";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch pending items ready for processing
    const now = new Date().toISOString();
    const { data: items, error: fetchError } = await supabase
      .from("media_download_queue")
      .select("*")
      .in("status", ["pending", "processing"])
      .lte("next_retry_at", now)
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const item of items) {
      // Mark as processing
      await supabase
        .from("media_download_queue")
        .update({ status: "processing", updated_at: now })
        .eq("id", item.id);

      try {
        const mediaBuffer = await downloadMedia(item, supabase);

        if (!mediaBuffer || !isValidMedia(new Uint8Array(mediaBuffer))) {
          throw new Error("Invalid media content (HTML or empty)");
        }

        // Upload to Supabase Storage
        const ext = getExtension(item.mimetype, item.media_type);
        const storagePath = `downloaded/${item.message_id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(storagePath, mediaBuffer, {
            contentType: item.mimetype || "application/octet-stream",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Create signed URL (1 year)
        const { data: signedData } = await supabase.storage
          .from("whatsapp-media")
          .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

        const signedUrl = signedData?.signedUrl;
        if (!signedUrl) throw new Error("Failed to create signed URL");

        // Update queue item
        await supabase
          .from("media_download_queue")
          .update({
            status: "completed",
            storage_path: storagePath,
            signed_url: signedUrl,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        // Update uazapi_messages
        if (item.uazapi_message_db_id) {
          await supabase
            .from("uazapi_messages")
            .update({ media_url: signedUrl })
            .eq("id", item.uazapi_message_db_id);
        }

        // Update ai_messages — CRITICAL for UI update via Realtime
        if (item.ai_message_id) {
          await supabase
            .from("ai_messages")
            .update({ media_url: signedUrl, updated_at: new Date().toISOString() })
            .eq("id", item.ai_message_id);
        }

        processed++;
      } catch (err) {
        const attempts = item.attempts + 1;
        const retryDelay = RETRY_DELAYS[Math.min(attempts, RETRY_DELAYS.length - 1)];
        const nextRetry = new Date(Date.now() + retryDelay).toISOString();

        await supabase
          .from("media_download_queue")
          .update({
            status: attempts >= item.max_attempts ? "failed" : "pending",
            attempts,
            last_error: String(err),
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        failed++;
        console.error(`Media download failed for ${item.message_id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("media-worker error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function downloadMedia(
  item: { media_url_source: string; media_key?: string; message_id: string; instance_id?: string },
  supabase: any
): Promise<ArrayBuffer | null> {
  // Strategy 1: Direct URL fetch (non-encrypted)
  if (item.media_url_source && !item.media_url_source.endsWith(".enc")) {
    try {
      const res = await fetch(item.media_url_source, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 100) return buf;
      }
    } catch { /* fallthrough */ }
  }

  // Strategy 2: UAZAPI downloadMedia endpoint
  if (item.instance_id) {
    const { data: instance } = await supabase
      .from("uazapi_instances")
      .select("api_url, api_token")
      .eq("id", item.instance_id)
      .single();

    if (instance) {
      const endpoints = [
        { url: `${instance.api_url}/chat/downloadMedia`, body: { messageId: item.message_id } },
        { url: `${instance.api_url}/chat/downloadMedia`, body: { id: item.message_id } },
        { url: `${instance.api_url}/message/download`, body: { messageId: item.message_id } },
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instance.api_token },
            body: JSON.stringify(ep.body),
            signal: AbortSignal.timeout(30_000),
          });

          if (!res.ok) continue;

          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const json = await res.json();
            const b64 = json.data || json.base64 || json.media || json.file;
            if (b64 && typeof b64 === "string") {
              const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              if (binary.length > 100) return binary.buffer;
            }
          } else {
            const buf = await res.arrayBuffer();
            if (buf.byteLength > 100) return buf;
          }
        } catch { /* try next */ }
      }
    }
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/media-worker/index.ts
git commit -m "feat: add media-worker edge function for async media download queue"
```

---

### Task 4: Modificar webhook para enfileirar midia ao inves de baixar sincronamente

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts`

- [ ] **Step 1: Ler o webhook atual**

Read: `supabase/functions/uazapi-webhook/index.ts` (focar nas linhas 410-773 — media download)

- [ ] **Step 2: Refatorar o bloco de download de midia**

Substituir o bloco de download sincrono (linhas ~410-773) por enfileiramento na `media_download_queue`. A logica deve:

1. **Antes** do download de midia, salvar a mensagem no banco com `media_url = null` e um placeholder tipo `'pending_download'` no campo `media_type`
2. Inserir um item na `media_download_queue` com `media_url_source`, `media_key`, `instance_id`, `message_id`
3. Tentar um download rapido (timeout 3s) — se funcionar, usar o resultado; se nao, deixar na fila
4. Invocar `media-worker` em background (fire-and-forget) para processar a fila
5. **Remover** os setTimeout retries existentes (linhas ~670-768) — a fila cuida disso

**IMPORTANTE:** A fila de midia deve ser inserida **DEPOIS** de salvar `uazapi_messages` e `ai_messages`, para que `ai_message_id` e `uazapi_message_db_id` estejam disponiveis no momento da insercao (evita race condition com o worker).

Mudanca principal — **apos** o insert de `uazapi_messages` e `ai_messages`, no trecho onde `hasMedia` e detectado:

```typescript
// ANTES: download sincrono bloqueante
// DEPOIS: enfileirar e tentar rapido (APOS salvar mensagens no banco)

if (hasMedia) {
  // Tentar download rapido (3s timeout) — otimista
  let quickMediaUrl: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    if (mediaUrl && !mediaUrl.endsWith(".enc")) {
      const res = await fetch(mediaUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (buf.byteLength > 100 && isValidMedia(bytes)) {
          const ext = getExtension(mimetype, messageType);
          const storagePath = `incoming/${phoneNumber}/${Date.now()}-${msgId}.${ext}`;
          await supabase.storage.from("whatsapp-media").upload(storagePath, buf, {
            contentType: mimetype || "application/octet-stream",
            upsert: true,
          });
          const { data: signed } = await supabase.storage
            .from("whatsapp-media")
            .createSignedUrl(storagePath, 365 * 24 * 60 * 60);
          quickMediaUrl = signed?.signedUrl || null;

          // Atualizar ai_messages e uazapi_messages com URL final
          if (quickMediaUrl) {
            await supabase.from("ai_messages").update({ media_url: quickMediaUrl, updated_at: new Date().toISOString() }).eq("id", aiMessageId);
            await supabase.from("uazapi_messages").update({ media_url: quickMediaUrl }).eq("id", uazapiMessageDbId);
          }
        }
      }
    }
  } catch {
    quickMediaUrl = null;
  }

  // Se nao conseguiu download rapido, enfileirar (com IDs ja disponiveis)
  if (!quickMediaUrl) {
    await supabase.from("media_download_queue").insert({
      message_id: msgId,
      instance_id: instanceId,
      ai_message_id: aiMessageId,
      uazapi_message_db_id: uazapiMessageDbId,
      conversation_id: conversationId,
      media_url_source: mediaUrl || "",
      media_key: mediaKey || null,
      media_type: messageType,
      mimetype: mimetype || null,
      status: "pending",
    });

    // Fire-and-forget: acionar worker
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/media-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }).catch(() => {});
  }
}
```

- [ ] **Step 3: Remover o antigo bloco de download sincrono e os setTimeout retries**

Remover:
- O bloco de download sincrono (linhas ~410-669) que baixa midia antes de salvar a mensagem
- Os setTimeout retries (linhas ~670-768) — a fila persistente substitui

Manter: A funcao `isValidMedia()` e `getExtension()` que sao reutilizadas.

- [ ] **Step 4: Atualizar o insert de `ai_messages` para aceitar `media_url = null`**

Quando a mensagem tem midia mas o download rapido falhou, salvar com `media_url = null` e `media_type` preenchido. O frontend usara `media_type != null && media_url == null` para mostrar skeleton.

```typescript
// Depois de inserir ai_messages e ter o ID:
if (queueItem?.id && !quickMediaUrl) {
  await supabase.from("media_download_queue").update({
    ai_message_id: aiMessageId,
    uazapi_message_db_id: uazapiMessageDbId,
    conversation_id: conversationId,
  }).eq("id", queueItem.id);
}
```

- [ ] **Step 4: Remover os setTimeout retries antigos**

Remover o bloco de retries com setTimeout (linhas ~670-768) que fazem polling. A fila persistente substitui isso com mais confiabilidade.

- [ ] **Step 5: Testar localmente**

Enviar uma imagem pelo WhatsApp e verificar:
1. Mensagem aparece no inbox imediatamente (com placeholder ou thumbnail)
2. Imagem carrega apos o worker processar (via Realtime UPDATE)
3. Na tabela `media_download_queue`, status deve ser `completed`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "feat: replace sync media download with persistent queue in webhook"
```

---

### Task 5: Atualizar frontend para exibir estado de download de midia

**Files:**
- Modify: `src/components/inbox/ChatArea.tsx` (componente `MediaContent`)

- [ ] **Step 1: Ler o componente MediaContent atual**

Read: `src/components/inbox/ChatArea.tsx` linhas 92-400

- [ ] **Step 2: Adicionar estado de "downloading" com skeleton**

Quando `media_url` for `null` mas `media_type` nao for `null`, mostrar skeleton com texto "Baixando midia...":

```tsx
// Dentro de MediaContent, adicionar checagem no inicio:
if (!mediaUrl && mediaType) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
      <div className="w-[200px] h-[150px] bg-gray-200 rounded-lg flex items-center justify-content-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
      <span className="text-xs text-gray-500">Baixando midia...</span>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar botao de retry que aciona o media-worker**

```tsx
// No fallback de erro de imagem, adicionar botao que chama media-worker:
const handleForceRetry = async () => {
  try {
    setRetrying(true);
    await supabase.functions.invoke("media-worker", { body: {} });
    toast.info("Processando midia em fila...");
    // O Realtime UPDATE vai atualizar a imagem automaticamente
  } catch {
    toast.error("Erro ao reprocessar midia");
  } finally {
    setRetrying(false);
  }
};
```

- [ ] **Step 4: Verificar subscription Realtime para updates de media_url**

Read: `src/hooks/useConversationMessages.ts` — verificar se o handler de UPDATE ja atualiza `media_url` no cache do React Query. O hook atual ja escuta UPDATEs em `ai_messages` e faz patch no cache (confirmado na exploracao). Verificar que o campo `media_url` esta incluido no patch:

```typescript
// Em useConversationMessages.ts — no handler de postgres_changes UPDATE:
// O payload.new contem todos os campos atualizados, incluindo media_url
// O handler ja faz patch no cache com spread: { ...existingMsg, ...payload.new }
// Isso significa que quando media-worker atualiza media_url, o UI recebe automaticamente
```

Se o handler de UPDATE nao fizer patch granular (apenas invalidate), adicionar:

```typescript
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'ai_messages',
  filter: `conversation_id=eq.${conversationId}`,
}, (payload) => {
  // Patch media_url in-place no cache
  queryClient.setQueryData(['messages', conversationId], (old: any) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        data: page.data.map((msg: any) =>
          msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
        ),
      })),
    };
  });
})
```

- [ ] **Step 5: Commit**

```bash
git add src/components/inbox/ChatArea.tsx src/hooks/useConversationMessages.ts
git commit -m "feat: add media download skeleton, retry button, and verify Realtime media_url updates"
```

---

### Task 6: Configurar pg_cron ou webhook periodico para processar fila

**Files:**
- Create: SQL migration via Supabase MCP

- [ ] **Step 1: Criar cron job via Supabase para processar fila a cada 1 minuto**

> **Nota:** pg_cron usa sintaxe cron padrao — granularidade minima e 1 minuto. O trigger principal e o fire-and-forget do webhook (Task 4). O cron e um safety net para itens que ficaram pendentes.

```sql
-- Habilitar extensoes necessarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron job: invocar media-worker a cada 1 minuto como safety net
SELECT cron.schedule(
  'process-media-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/media-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Alternativa (se pg_cron nao disponivel):** O fire-and-forget do webhook (Task 4) ja aciona o worker a cada mensagem com midia. O cron apenas garante que itens que falharam sejam reprocessados.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add pg_cron job to process media download queue every 1 minute"
```

---

## Phase 2: Otimizacao de Latencia (Resolve problema 1)

### Task 7: Webhook — otimizar hot path para reduzir latencia

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts`

> **Nota:** Supabase Edge Functions (Deno Deploy) **NAO suportam** `EdgeRuntime.waitUntil`. O isolate pode ser terminado apos retornar a Response. Portanto, mantemos o processamento sincrono mas otimizamos o hot path removendo operacoes desnecessarias.

- [ ] **Step 1: Ler a estrutura do handler principal**

Read: `supabase/functions/uazapi-webhook/index.ts` linhas 1-50 (handler entry)

- [ ] **Step 2: Otimizar o hot path do webhook**

A principal latencia vinha do download sincrono de midia (ja resolvido na Task 4). Agora otimizar o restante:

1. **Early return para eventos irrelevantes** — rejeitar `connection.update`, `poll_update`, e eventos sem mensagem no inicio do handler
2. **Cache de instancia** (Task 9) — evitar query ao banco a cada mensagem
3. **Paralelizar operacoes independentes** — usar `Promise.all` para queries que nao dependem uma da outra

```typescript
// No inicio do handler, rejeitar rapido:
const eventType = body.EventType || body.event || body.type || "";
const SKIP_EVENTS = ["connection.update", "presence.update", "contacts.update", "groups.update"];
if (SKIP_EVENTS.includes(eventType)) {
  return new Response("OK", { status: 200, headers: corsHeaders });
}

// Verificar se tem mensagem — rejeitar se nao
const msg = body.message || body.data?.message;
if (!msg) {
  return new Response("OK", { status: 200, headers: corsHeaders });
}
```

3. **Paralelizar dedup check + instance lookup:**

```typescript
// ANTES: sequencial
// const instance = await getInstance(...)
// const existing = await checkDedup(...)

// DEPOIS: paralelo
const [instance, existing] = await Promise.all([
  getInstanceCached(supabase, instanceName),
  supabase.from("uazapi_messages").select("id").eq("message_id", msgId).eq("instance_id", instanceId).maybeSingle(),
]);

if (existing.data) return new Response("OK", { status: 200, headers: corsHeaders });
```

- [ ] **Step 3: Extrair corpo para funcao `processWebhook`**

Refatorar para melhor legibilidade — mover o corpo do handler para `async function processWebhook(body, supabase)`. Isso facilita manutencao sem mudar o comportamento sincrono.

- [ ] **Step 4: Testar latencia**

Enviar mensagem de texto e medir tempo ate aparicao no inbox. Target: < 2 segundos.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "perf: optimize webhook hot path with early returns, parallel queries, and instance cache"
```

---

### Task 8: Reduzir debounce de mensagens

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts`
- Modify: `supabase/functions/process-incoming-message/index.ts`

- [ ] **Step 1: Ler configuracao de debounce atual**

Read: `supabase/functions/process-incoming-message/index.ts` linhas 217-242
Read: `supabase/functions/uazapi-webhook/index.ts` linhas 1588-1603

- [ ] **Step 2: Reduzir janela de debounce de 5s para 2s**

No webhook, alterar a janela de debounce de 5000ms para 2000ms. No `process-incoming-message`, reduzir a janela de 3s para 1.5s:

```typescript
// uazapi-webhook: mudar de 5000 para 2000
const DEBOUNCE_WINDOW_MS = 2000;

// process-incoming-message: mudar de 3s para 1.5s
const TYPING_WINDOW_S = 1.5;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts supabase/functions/process-incoming-message/index.ts
git commit -m "perf: reduce debounce window from 5s/3s to 2s/1.5s for faster message processing"
```

---

### Task 9: Cache de instancia no webhook

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts`

- [ ] **Step 1: Adicionar cache em memoria para lookup de instancia**

O webhook faz query na tabela `uazapi_instances` a cada mensagem. Adicionar cache in-memory com TTL de 5 minutos:

```typescript
// No topo do arquivo, fora do handler
const instanceCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getInstanceCached(supabase: any, instanceName: string) {
  const cached = instanceCache.get(instanceName);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const { data } = await supabase
    .from("uazapi_instances")
    .select("*")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (data) {
    instanceCache.set(instanceName, { data, expiry: Date.now() + CACHE_TTL });
  }
  return data;
}
```

- [ ] **Step 2: Substituir queries diretas pelo cache**

Buscar todos os `.from("uazapi_instances").select(...)` no webhook e substituir por `getInstanceCached()`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "perf: add in-memory instance cache (5min TTL) to reduce DB queries in webhook"
```

---

## Phase 3: Suporte a Grupos (Resolve problemas 4 e 5)

### Task 10: Webhook — salvar metadata de grupo

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts`

- [ ] **Step 1: Ler bloco de deteccao de grupo**

Read: `supabase/functions/uazapi-webhook/index.ts` linhas 800-805

- [ ] **Step 2: Enriquecer deteccao de grupo**

Quando `chatJid.includes("@g.us")`:

```typescript
const isGroup = chatJid.includes("@g.us");

if (isGroup) {
  const groupName = body.chat?.name
    || body.chat?.subject
    || body.groupMetadata?.subject
    || body.message?.pushName
    || `Grupo ${chatJid.split("@")[0]}`;

  // Extrair remetente individual no grupo
  const senderInGroup = body.message?.key?.participant
    || body.message?.participant
    || body.sender?.id
    || "";
  const senderNameInGroup = body.message?.pushName
    || body.message?.senderName
    || body.sender?.pushName
    || "";

  // Ao criar/atualizar conversa:
  conversationData.is_group = true;
  conversationData.group_name = groupName;
  conversationData.group_jid = chatJid;

  // Ao salvar ai_messages:
  aiMessageData.sender_name = senderNameInGroup;
  aiMessageData.sender_phone = senderInGroup.replace(/@.*/, "");
}
```

- [ ] **Step 3: Garantir que contato tipo "Grupo" tenha nome correto**

O campo `uazapi_chats.is_group` ja existe no schema. Garantir que o `contact_name` use o nome do grupo (nao o pushName do remetente):

```typescript
// Na criacao/update de uazapi_chats (ja existe, apenas garantir):
if (isGroup) {
  chatData.contact_name = groupName; // Nome do grupo, nao do remetente
  chatData.is_group = true;          // Campo ja existe na tabela
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "feat: save group metadata (is_group, group_name, sender per message) in webhook"
```

---

### Task 11: Frontend — Badge de grupo e nome do remetente

**Files:**
- Create: `src/components/inbox/GroupBadge.tsx`
- Create: `src/components/inbox/GroupSenderName.tsx`
- Modify: `src/components/inbox/ChatArea.tsx`
- Modify: `src/hooks/useInboxConversations.ts` (ou componente de lista)

- [ ] **Step 1: Criar componente GroupBadge**

```tsx
// src/components/inbox/GroupBadge.tsx
import { Users } from "lucide-react";

interface GroupBadgeProps {
  groupName?: string | null;
  className?: string;
}

export function GroupBadge({ groupName, className = "" }: GroupBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] ${className}`}
    >
      <Users size={10} />
      {groupName || "Grupo"}
    </span>
  );
}
```

- [ ] **Step 2: Criar componente GroupSenderName**

```tsx
// src/components/inbox/GroupSenderName.tsx
interface GroupSenderNameProps {
  senderName: string | null;
  senderPhone?: string | null;
}

// Cores deterministicas por hash do nome
const SENDER_COLORS = [
  "#DC2626", "#2563EB", "#16A34A", "#7C3AED",
  "#EA580C", "#0891B2", "#CA8A04", "#BE185D",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

export function GroupSenderName({ senderName, senderPhone }: GroupSenderNameProps) {
  const displayName = senderName || senderPhone || "Desconhecido";
  const color = hashColor(displayName);

  return (
    <span
      className="text-[11px] font-semibold block mb-0.5"
      style={{ color }}
    >
      {displayName}
    </span>
  );
}
```

- [ ] **Step 3: Integrar no ChatArea — mostrar nome do remetente em mensagens de grupo**

No componente de bolha de mensagem em `ChatArea.tsx`, antes do conteudo:

```tsx
// Dentro do render de cada mensagem (msg de role="user" em grupo):
{conversation?.is_group && msg.role === "user" && (
  <GroupSenderName
    senderName={msg.sender_name}
    senderPhone={msg.sender_phone}
  />
)}
```

- [ ] **Step 4: Integrar na lista de conversas — badge de grupo**

Na lista de conversas do inbox, adicionar badge:

```tsx
// Junto ao nome do contato na lista:
{conversation.is_group && (
  <GroupBadge groupName={conversation.group_name} className="ml-1" />
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/inbox/GroupBadge.tsx src/components/inbox/GroupSenderName.tsx src/components/inbox/ChatArea.tsx
git commit -m "feat: add GroupBadge and GroupSenderName components for group chat display"
```

---

### Task 12: Orchestrator — roteamento para agente de grupo

**Files:**
- Modify: `supabase/functions/orchestrator/index.ts`

- [ ] **Step 1: Ler orchestrator atual**

Read: `supabase/functions/orchestrator/index.ts` completo

- [ ] **Step 2: Adicionar roteamento por grupo**

Antes da chamada LLM no orchestrator, verificar se a conversa e de grupo:

```typescript
// No inicio da funcao de selecao de agente:
if (conversation.is_group) {
  // Buscar agente com specialty = 'group_support'
  const { data: groupAgent } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("specialty", "group_support")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (groupAgent) {
    // Verificar se agente esta configurado para esta instancia
    const instanceMatch = !groupAgent.whatsapp_instance_ids
      || groupAgent.whatsapp_instance_ids.length === 0
      || groupAgent.whatsapp_instance_ids.includes(instanceId);

    if (instanceMatch) {
      return {
        action: "agent",
        agent_id: groupAgent.id,
        agent_name: groupAgent.name,
        reason: "Mensagem de grupo roteada para agente especialista",
      };
    }
  }

  // Se nao tem agente de grupo, ignorar silenciosamente
  // (grupos sem agente configurado nao recebem resposta)
  return {
    action: "ignore",
    reason: "Grupo sem agente de grupo configurado",
  };
}
```

- [ ] **Step 3: Adicionar logica de "responder apenas quando mencionado" para grupos**

No agente de grupo, verificar se a mensagem menciona o nome do bot ou e um reply direto:

```typescript
// Em ai-whatsapp-reply ou process-incoming-message:
if (conversation.is_group && agent?.specialty === "group_support") {
  const botName = agent.name?.toLowerCase() || "";
  const msgText = messageContent.toLowerCase();
  const isDirectReply = msg.quoted_message_id && msg.quoted_from_me;
  const isMentioned = msgText.includes(`@${botName}`) || msgText.includes(botName);

  // Modo silencioso: so responde quando mencionado ou em reply
  if (agent.support_config?.group_mode === "silent" && !isDirectReply && !isMentioned) {
    return { action: "ignore", reason: "Grupo em modo silencioso, bot nao mencionado" };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/orchestrator/index.ts
git commit -m "feat: add group message routing to orchestrator with silent mode support"
```

---

### Task 13: Criar agente de grupo via seed/UI

**Files:**
- Nenhum arquivo de codigo — criacao via UI ou SQL

- [ ] **Step 1: Documentar a criacao do agente de grupo**

O agente de grupo pode ser criado via UI em `/agents` ou via SQL:

```sql
INSERT INTO public.ai_agents (
  name, specialty, system_prompt, model, is_active, tools, support_config
) VALUES (
  'Assistente de Grupo',
  'group_support',
  'Voce e um assistente de grupo WhatsApp da Sismais. Responda duvidas dos membros do grupo de forma clara e objetiva.

Regras:
- Seja conciso (grupos tem muitas mensagens)
- Enderece a pessoa pelo nome quando possivel
- Se a pergunta nao for para voce, ignore
- Nao repita informacoes ja ditas no grupo
- Para assuntos complexos, sugira abrir um ticket de suporte

Contexto: Voce esta num grupo de clientes da Sismais que usam o sistema GMS.',
  'google/gemini-2.0-flash-001',
  true,
  '[]',
  '{"group_mode": "silent", "respond_to_mentions": true, "respond_to_replies": true}'
);
```

- [ ] **Step 2: Adicionar `group_support` como opcao de specialty no formulario de agentes**

Read: `src/components/agents/` — encontrar o formulario de criacao de agente e adicionar `group_support` ao select de specialty.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add group_support specialty option to agent form"
```

---

## Phase 4: Verificacao e Deploy

### Task 14: Testes de integracao end-to-end

- [ ] **Step 1: Testar recebimento de mensagem de texto**
  - Enviar texto pelo WhatsApp
  - Verificar que aparece no inbox em < 2s
  - Verificar Realtime subscription funcionando

- [ ] **Step 2: Testar recebimento de imagem**
  - Enviar imagem pelo WhatsApp
  - Verificar skeleton "Baixando midia..." aparece imediatamente
  - Verificar que imagem carrega apos worker processar (verificar `media_download_queue`)
  - Verificar que retry funciona se falhar

- [ ] **Step 3: Testar mensagem de grupo**
  - Enviar mensagem em grupo WhatsApp
  - Verificar badge "Grupo" na lista de conversas
  - Verificar nome do remetente na bolha de mensagem
  - Verificar que agente de grupo responde (se configurado)

- [ ] **Step 4: Testar modo silencioso de grupo**
  - Enviar mensagem sem mencionar o bot — nao deve responder
  - Mencionar o bot — deve responder
  - Reply direto ao bot — deve responder

- [ ] **Step 5: Verificar fila de midia**
  - Consultar `media_download_queue` — todos os itens devem estar `completed` ou `failed`
  - Itens `failed` devem ter `last_error` preenchido
  - Verificar que `ai_messages.media_url` foi atualizado via Realtime

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "test: verify end-to-end UAZAPI integration improvements"
```

---

## Resumo de Impacto

| Problema | Task(s) | Melhoria Esperada |
|----------|---------|-------------------|
| Demora no recebimento | T7, T8, T9 | Texto: < 2s (era ~5s). Webhook retorna 200 imediatamente |
| Imagens nao carregam | T1, T3, T4, T5, T6 | Fila persistente com 5 retries. Nunca perde midia |
| Demora no envio de imagens | T3, T4 | Download assincrono, nao bloqueia UI |
| Grupo nao identificado | T2, T10, T11 | Badge "Grupo" + nome do remetente por mensagem |
| Agente de grupo | T12, T13 | Agente `group_support` com modo silencioso |
