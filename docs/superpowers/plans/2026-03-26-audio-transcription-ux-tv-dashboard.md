# Fix Transcrição + UX Áudio + Dashboard TV com PIN — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a transcrição de áudio que nunca é executada, melhorar o UX do player de áudio e adicionar acesso público por PIN ao Dashboard TV.

**Architecture:** Três frentes independentes: (1) fix cirúrgico no webhook + nova edge function de retry com cron; (2) lazy loading do elemento `<audio>` no componente `MediaContent` do `ChatArea`; (3) nova página `TVPublicGate` com teclado numérico PIN + botão de nova aba na Sidebar + campo de config nas Settings.

**Tech Stack:** React 18 + TypeScript + Deno (Edge Functions) + Supabase + shadcn/ui + TailwindCSS + React Router v6

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/functions/uazapi-webhook/index.ts` | Modificar | Fix 1 linha: incluir `finalMediaUrl` no fallback de `transcriptionUrl` |
| `supabase/functions/retry-failed-transcriptions/index.ts` | Criar | Job de retry: busca áudios com transcrição falha e re-dispara |
| `supabase/config.toml` | Modificar | Registrar nova função sem JWT |
| `src/components/inbox/ChatArea.tsx` | Modificar | Lazy loading do `<audio>` + botão Re-transcrever visível + `--:--` skeleton |
| `src/pages/TVPublicGate.tsx` | Criar | Tela de PIN + renderiza TVDashboard quando desbloqueado |
| `src/App.tsx` | Modificar | Rota pública `/tv` sem ProtectedRoute |
| `src/components/layout/Sidebar.tsx` | Modificar | Botão ExternalLink ao lado de "Dashboard TV" |
| `src/pages/Settings.tsx` | Modificar | Nova aba "TV Dashboard" com campo de PIN |
| `src/components/settings/TVDashboardSettingsTab.tsx` | Criar | Componente da aba de configuração do PIN |

---

## Task 1: Fix cirúrgico no `uazapi-webhook` — incluir `finalMediaUrl` no fallback de transcrição

**Contexto:** Na linha ~1559 do webhook, `transcriptionUrl` usa `storedMediaUrl` ou CDN URL bruta. Mas quando o upload ao Storage falha com URL CDN preservada como fallback (linha ~758), essa URL fica em `storedMediaUrl`. O problema é que `mediaUrl` original pode já ter expirado e `storedMediaUrl` pode estar vazio em outros cenários. `finalMediaUrl` (linha 772) consolida ambos e é a fonte mais confiável.

**Arquivos:**
- Modificar: `supabase/functions/uazapi-webhook/index.ts` (linha ~1559)

- [ ] **Step 1: Localizar o trecho exato**

Abrir `supabase/functions/uazapi-webhook/index.ts` e encontrar a linha que contém:
```typescript
const transcriptionUrl = storedMediaUrl || (mediaUrl && mediaUrl.startsWith("http") ? mediaUrl : "");
```
Está próximo ao comentário `// ===== ASYNC TRANSCRIPTION for audio/image/ptt messages`.

- [ ] **Step 2: Aplicar o fix**

Substituir exatamente essa linha por:
```typescript
const transcriptionUrl = storedMediaUrl
  || (mediaUrl && mediaUrl.startsWith("http") ? mediaUrl : "")
  || (finalMediaUrl && finalMediaUrl.startsWith("http") ? finalMediaUrl : "");
```

- [ ] **Step 3: Verificar que o bloco de log abaixo ainda faz sentido**

A linha seguinte faz `console.log` com `using=${storedMediaUrl ? 'stored' : 'cdn-fallback'}`. Atualizar para incluir o terceiro caso:
```typescript
console.log(`[webhook] Triggering transcription for ${mediaType} message (msgId=${msgId}), using=${storedMediaUrl ? 'stored' : (mediaUrl ? 'cdn-raw' : 'final-fallback')}`);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "fix(webhook): include finalMediaUrl as third fallback for transcriptionUrl

Ensures audio/image messages with failed storage upload but valid CDN URL
still trigger transcription instead of being immediately marked as failed.

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 2: Edge function `retry-failed-transcriptions`

**Contexto:** Mensagens de áudio já salvas no banco com `content = '[Áudio - transcrição falhou]'` mas com `media_url` válida podem ser reprocessadas. Essa função busca essas mensagens e re-invoca `transcribe-media` para cada uma. Rodará via cron a cada 5 minutos.

**Arquivos:**
- Criar: `supabase/functions/retry-failed-transcriptions/index.ts`
- Modificar: `supabase/config.toml`

- [ ] **Step 1: Criar o arquivo da edge function**

Criar `supabase/functions/retry-failed-transcriptions/index.ts` com o conteúdo:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

const FAILED_CONTENT_MARKERS = [
  '[Áudio - transcrição falhou]',
  '[audio]',
  '[ptt]',
  '[Áudio]',
]

const MAX_RETRY_PER_RUN = 20
const MAX_AGE_HOURS = 24

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()

    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('id, conversation_id, media_url, media_type, content')
      .in('content', FAILED_CONTENT_MARKERS)
      .in('media_type', ['audio', 'ptt'])
      .not('media_url', 'is', null)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_RETRY_PER_RUN)

    if (error) throw error

    if (!messages || messages.length === 0) {
      console.log('[retry-failed-transcriptions] No failed messages to retry')
      return new Response(JSON.stringify({ retried: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[retry-failed-transcriptions] Found ${messages.length} messages to retry`)

    let retried = 0
    for (const msg of messages) {
      if (!msg.media_url) continue
      try {
        const { error: invokeError } = await supabase.functions.invoke('transcribe-media', {
          body: {
            message_id: msg.id,
            conversation_id: msg.conversation_id,
            media_url: msg.media_url,
            media_type: msg.media_type,
          },
        })
        if (invokeError) {
          console.error(`[retry] Failed to invoke transcribe-media for msg ${msg.id}:`, invokeError)
        } else {
          retried++
          console.log(`[retry] Re-queued transcription for msg ${msg.id}`)
        }
      } catch (err) {
        console.error(`[retry] Unexpected error for msg ${msg.id}:`, err)
      }
    }

    return new Response(
      JSON.stringify({ retried, found: messages.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[retry-failed-transcriptions] Error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
```

- [ ] **Step 2: Registrar em `config.toml`**

Adicionar ao final de `supabase/config.toml`:
```toml
[functions.retry-failed-transcriptions]
verify_jwt = false
# schedule = "*/5 * * * *"  # Configure via Supabase Dashboard — cron every 5 minutes
```

- [ ] **Step 3: Verificar sintaxe do arquivo Deno**

```bash
cd supabase/functions/retry-failed-transcriptions
deno check index.ts 2>&1 || echo "Check done (ignore network errors)"
```

Expected: sem erros de sintaxe TypeScript.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/retry-failed-transcriptions/index.ts supabase/config.toml
git commit -m "feat(edge): add retry-failed-transcriptions cron job

Queries ai_messages with failed audio transcription markers and re-invokes
transcribe-media for each one. Limits to 20 messages per run, max 24h age.
Configure cron schedule via Supabase Dashboard: */5 * * * *

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 3: UX do player de áudio — lazy loading + skeleton + botão visível

**Contexto:** O componente `MediaContent` em `src/components/inbox/ChatArea.tsx` renderiza um `<audio preload="metadata">` imediatamente, causando lentidão em listas grandes. Além disso, o botão "Re-transcrever" é um `<button>` inline tiny.

**Arquivos:**
- Modificar: `src/components/inbox/ChatArea.tsx` (função `MediaContent`, bloco `case 'audio': case 'ptt':`)

- [ ] **Step 1: Adicionar estado `audioRequested` ao `MediaContent`**

No bloco de estados do `MediaContent` (próximo à linha 109 onde estão os outros `useState`), adicionar:
```tsx
const [audioRequested, setAudioRequested] = useState(false)
```

- [ ] **Step 2: Atualizar `handleAudioPlayPause` para fazer lazy load**

Substituir a função existente `handleAudioPlayPause` (linhas ~183-192):
```tsx
const handleAudioPlayPause = () => {
  if (!audioRequested) {
    // Primeira vez: solicita o carregamento e o play acontecerá no useEffect
    setAudioRequested(true)
    return
  }
  const audio = audioElRef.current
  if (!audio) return
  if (audioPlaying) {
    audio.pause()
  } else {
    audio.play()
  }
  setAudioPlaying(!audioPlaying)
}
```

- [ ] **Step 3: Adicionar `useEffect` para auto-play quando o elemento montar**

Após os `useEffect` existentes (próximo à linha 170), adicionar:
```tsx
// Auto-play quando o elemento <audio> monta pela primeira vez após clique
useEffect(() => {
  if (!audioRequested) return
  const audio = audioElRef.current
  if (!audio) return
  audio.play().catch(() => {
    // Autoplay bloqueado pelo browser — usuário precisará clicar novamente
  })
  setAudioPlaying(true)
}, [audioRequested])
```

- [ ] **Step 4: Atualizar o elemento `<audio>` para montar apenas quando solicitado**

Localizar o elemento `<audio>` (linha ~787):
```tsx
<audio
  ref={audioElRef}
  src={effectiveUrl!}
  preload="metadata"
  ...
/>
```

Substituir por:
```tsx
{audioRequested && (
  <audio
    ref={audioElRef}
    src={effectiveUrl!}
    preload="auto"
    onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
    onTimeUpdate={(e) => {
      const audio = e.currentTarget
      setAudioCurrentTime(audio.currentTime)
      setAudioProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
    }}
    onEnded={() => { setAudioPlaying(false); setAudioProgress(0); setAudioCurrentTime(0) }}
    onError={async () => {
      if (!autoRefreshAttempted) {
        setAutoRefreshAttempted(true)
        if (isSupabaseStorageUrl) {
          try {
            const signMatch = effectiveUrl?.match(/\/object\/sign\/whatsapp-media\/([^?]+)/)
            const publicMatch = effectiveUrl?.match(/\/object\/public\/whatsapp-media\/([^?]+)/)
            const pathMatch = signMatch || publicMatch
            if (pathMatch) {
              const { data: signedData } = await supabase.storage
                .from('whatsapp-media')
                .createSignedUrl(pathMatch[1], 31536000)
              if (signedData?.signedUrl) setResolvedUrl(signedData.signedUrl)
            }
          } catch { /* ignore */ }
        }
      }
    }}
  />
)}
```

**Nota:** O trecho de `onError` existente pode ser mais longo — copiar o conteúdo completo do `onError` existente para não perder a lógica de refresh de URL assinada. Verificar o conteúdo completo do handler antes de substituir.

- [ ] **Step 5: Atualizar `formatDuration` para mostrar `--:--` quando duração é zero**

Localizar (linha ~176):
```tsx
const formatDuration = (seconds: number) => {
  if (!seconds || !isFinite(seconds)) return '0:00'
  ...
}
```

Substituir por:
```tsx
const formatDuration = (seconds: number, placeholder = '0:00') => {
  if (!seconds || !isFinite(seconds)) return placeholder
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

E nos dois usos de `formatDuration(audioDuration)` (linha ~757), passar o placeholder:
```tsx
<span className="text-xs text-muted-foreground">
  {audioRequested ? formatDuration(audioDuration, '--:--') : '--:--'}
</span>
```

- [ ] **Step 6: Tornar o botão Re-transcrever mais visível**

Localizar o botão inline (linhas ~765-775):
```tsx
<button
  onClick={handleRetranscribe}
  disabled={retranscribing}
  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
>
  {retranscribing
    ? <><Loader2 className="w-3 h-3 animate-spin" /> Re-transcrevendo...</>
    : <><RefreshCw className="w-3 h-3" /> Re-transcrever</>
  }
</button>
```

Substituir por (usando shadcn Button — já importado em ChatArea):
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleRetranscribe}
  disabled={retranscribing}
  className="h-7 text-xs gap-1.5 mt-1"
>
  {retranscribing
    ? <><Loader2 className="w-3 h-3 animate-spin" /> Re-transcrevendo...</>
    : <><RefreshCw className="w-3 h-3" /> Re-transcrever</>
  }
</Button>
```

- [ ] **Step 7: Verificar build sem erros TypeScript**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeded sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/components/inbox/ChatArea.tsx
git commit -m "feat(ux): lazy load audio player + visible re-transcribe button

- Audio element only mounts on first play click (saves network on list render)
- Duration shows '--:--' before audio loads instead of '0:00'
- Re-transcrever uses shadcn Button outline/sm for better visibility

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 4: Página `TVPublicGate` com teclado PIN

**Contexto:** Nova página sem autenticação Supabase. Lê o PIN configurado via `platform_ai_config` usando a publishable key (RLS permite SELECT público). Armazena sessão desbloqueada em `localStorage` com TTL de 8h. Usa dados em memória — não faz login real.

**Arquivos:**
- Criar: `src/pages/TVPublicGate.tsx`

- [ ] **Step 1: Criar `src/pages/TVPublicGate.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import TVDashboard from './TVDashboard'
import { Delete } from 'lucide-react'

const SESSION_KEY = 'tv_pin_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 horas
const PIN_LENGTH = 4
const DEFAULT_PIN = '1234'

// Cliente público (publishable key) — só leitura com RLS
const publicSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

function isSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const { exp } = JSON.parse(raw)
    return Date.now() < exp
  } catch {
    return false
  }
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }))
}

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export default function TVPublicGate() {
  const [unlocked, setUnlocked] = useState(isSessionValid)
  const [digits, setDigits] = useState<string[]>([])
  const [configuredPin, setConfiguredPin] = useState<string>(DEFAULT_PIN)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Carrega PIN configurado
  useEffect(() => {
    publicSupabase
      .from('platform_ai_config')
      .select('extra_config')
      .eq('feature', 'tv_dashboard_pin')
      .maybeSingle()
      .then(({ data }) => {
        const pin = (data?.extra_config as Record<string, string> | null)?.pin
        if (pin && /^\d{4,6}$/.test(pin)) setConfiguredPin(pin)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleKey = useCallback((key: string) => {
    if (key === 'del') {
      setDigits(prev => prev.slice(0, -1))
      setError(false)
      return
    }
    if (key === '') return // espaço vazio no teclado
    setDigits(prev => {
      if (prev.length >= PIN_LENGTH) return prev
      const next = [...prev, key]
      if (next.length === PIN_LENGTH) {
        const entered = next.join('')
        if (entered === configuredPin) {
          saveSession()
          setTimeout(() => setUnlocked(true), 200) // pequeno delay para feedback visual
        } else {
          setError(true)
          setTimeout(() => {
            setDigits([])
            setError(false)
          }, 800)
        }
      }
      return next
    })
  }, [configuredPin])

  // Suporte a teclado físico
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace') handleKey('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey])

  if (unlocked) return <TVDashboard />

  if (loading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen" style={{ background: '#10293F' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#45E5E5', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center w-screen h-screen gap-10"
      style={{ background: '#10293F', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <span
          className="text-2xl font-bold px-4 py-2 rounded-lg"
          style={{ background: '#45E5E5', color: '#10293F', fontFamily: 'Poppins, sans-serif' }}
        >
          GMS
        </span>
        <span className="text-white/70 text-sm tracking-wider uppercase">Dashboard TV</span>
      </div>

      {/* Indicadores de dígito */}
      <div className="flex gap-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full transition-all duration-150"
            style={{
              background: error
                ? '#DC2626'
                : i < digits.length
                  ? '#45E5E5'
                  : 'rgba(255,255,255,0.2)',
              transform: i < digits.length ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3">
        {NUM_KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              onClick={() => handleKey(key)}
              className="flex items-center justify-center rounded-xl text-white font-semibold text-xl transition-all duration-100 select-none"
              style={{
                width: 72,
                height: 72,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              onMouseDown={e => (e.currentTarget.style.background = 'rgba(69,229,229,0.2)')}
              onMouseUp={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              {key === 'del' ? <Delete className="w-5 h-5" /> : key}
            </button>
          )
        })}
      </div>

      <span className="text-white/30 text-xs">Digite o PIN para acessar</span>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que TVDashboard funciona sem AuthContext**

Abrir `src/pages/TVDashboard.tsx` e verificar se o componente chama `useAuth()` ou `useSupabaseAuth()`. Se chamar, o acesso sem login quebrará.

```bash
grep -n "useAuth\|useSupabaseAuth\|AuthContext" src/pages/TVDashboard.tsx src/hooks/useTVDashboardMetrics.ts
```

Se encontrar chamadas a `useAuth`, anotar quais hooks/queries precisam de autenticação para resolver na Task seguinte.

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeded.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TVPublicGate.tsx
git commit -m "feat(tv): add TVPublicGate with 4-digit PIN screen

PIN loaded from platform_ai_config (feature=tv_dashboard_pin).
Session stored in localStorage with 8h TTL. Supports physical keyboard.
Falls back to PIN '1234' if not configured.

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 5: Rota pública `/tv` no `App.tsx`

**Contexto:** A rota `/tv-dashboard` existente está dentro de `ProtectedRoute`. A nova rota `/tv` é pública e renderiza `TVPublicGate`.

**Arquivos:**
- Modificar: `src/App.tsx`

- [ ] **Step 1: Adicionar import lazy de `TVPublicGate`**

Após a linha `const TVDashboard = lazyRetry(() => import("./pages/TVDashboard"))` (linha ~86), adicionar:
```tsx
const TVPublicGate = lazyRetry(() => import("./pages/TVPublicGate"))
```

- [ ] **Step 2: Adicionar rota `/tv` sem proteção**

No bloco de rotas públicas (próximo à linha 180, onde ficam `/manual`, `/help-center`, `/tv-dashboard`), adicionar:
```tsx
<Route path="/tv" element={<TVPublicGate />} />
```

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeded.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): add public /tv route for PIN-gated TV dashboard

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 6: Botão "Abrir em nova aba" na Sidebar

**Contexto:** O item "Dashboard TV" na sidebar é um `Link` normal. Adicionar um ícone `ExternalLink` que abre `/tv` em nova aba sem navegar na app atual.

**Arquivos:**
- Modificar: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Verificar como o item "Dashboard TV" é renderizado**

Buscar no arquivo como os itens da categoria "Relatórios" são renderizados. Procurar o padrão de renderização de `MenuItem` com `path`. Identificar o componente/JSX que gera cada item de menu.

```bash
grep -n "Dashboard TV\|item\.path\|item\.label\|MenuItem" src/components/layout/Sidebar.tsx | head -30
```

- [ ] **Step 2: Adicionar `ExternalLink` ao import de lucide-react**

Já existe uma lista de imports de `lucide-react` no início do arquivo. Adicionar `ExternalLink` à lista:
```tsx
import {
  // ... imports existentes ...
  ExternalLink,
} from 'lucide-react'
```

- [ ] **Step 3: Adicionar renderização especial para o item "Dashboard TV"**

Localizar onde cada item de menu é renderizado (loop de `navGroups` ou similar). Dentro do render do item, adicionar lógica especial para o item com `path === '/tv-dashboard'`:

```tsx
{item.path === '/tv-dashboard' ? (
  // Item especial: link normal + botão nova aba
  <div className="flex items-center w-full group/tv">
    <Link
      to={item.path}
      className={cn(
        // manter as mesmas classes do link normal
        "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
    {!collapsed && (
      <button
        onClick={(e) => { e.stopPropagation(); window.open('/tv', '_blank') }}
        title="Abrir Dashboard TV em nova aba"
        className="opacity-0 group-hover/tv:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all mr-1"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
) : (
  // Renderização normal do item (manter o código existente)
  <Link to={item.path} ...>...</Link>
)}
```

**Nota:** As classes CSS exatas do link devem ser copiadas do código existente para manter consistência visual. Verificar o código real antes de aplicar.

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeded.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): add open-in-new-tab button for Dashboard TV

Shows ExternalLink icon on hover next to 'Dashboard TV' item.
Opens /tv (PIN-gated public route) in a new browser tab.

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 7: Configuração de PIN nas Settings

**Contexto:** Admins precisam configurar o PIN do Dashboard TV. Adicionar nova aba "TV Dashboard" nas configurações com um campo de PIN de 4 dígitos. Salva em `platform_ai_config` com `feature = 'tv_dashboard_pin'` e o PIN em `extra_config.pin`.

**Arquivos:**
- Criar: `src/components/settings/TVDashboardSettingsTab.tsx`
- Modificar: `src/pages/Settings.tsx`

- [ ] **Step 1: Criar `src/components/settings/TVDashboardSettingsTab.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Tv, ExternalLink, Save } from 'lucide-react'

const FEATURE_KEY = 'tv_dashboard_pin'

export default function TVDashboardSettingsTab() {
  const qc = useQueryClient()
  const [pin, setPin] = useState('')
  const [loaded, setLoaded] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['platform_ai_config', FEATURE_KEY],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_ai_config')
        .select('extra_config')
        .eq('feature', FEATURE_KEY)
        .maybeSingle()
      const currentPin = (data?.extra_config as Record<string, string> | null)?.pin || '1234'
      if (!loaded) {
        setPin(currentPin)
        setLoaded(true)
      }
      return currentPin
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (newPin: string) => {
      const { error } = await supabase
        .from('platform_ai_config')
        .upsert(
          { feature: FEATURE_KEY, enabled: true, extra_config: { pin: newPin } },
          { onConflict: 'feature' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('PIN do Dashboard TV salvo!')
      qc.invalidateQueries({ queryKey: ['platform_ai_config', FEATURE_KEY] })
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar PIN: ' + err.message)
    },
  })

  const handleSave = () => {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('PIN deve ter 4 a 6 dígitos numéricos')
      return
    }
    saveMutation.mutate(pin)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tv className="w-4 h-4" />
            Acesso ao Dashboard TV
          </CardTitle>
          <CardDescription>
            Configure o PIN de acesso à tela de Dashboard TV pública (
            <a
              href="/tv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-1"
            >
              /tv <ExternalLink className="w-3 h-3" />
            </a>
            ). Este PIN permite acesso sem login, ideal para exibição em TVs ou monitores de equipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="tv-pin">PIN de Acesso (4 a 6 dígitos)</Label>
            <Input
              id="tv-pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Padrão: 1234. A sessão fica ativa por 8 horas após digitar o PIN correto.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading} size="sm">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar PIN'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar aba no `Settings.tsx`**

No `Settings.tsx`, adicionar o import:
```tsx
import TVDashboardSettingsTab from "@/components/settings/TVDashboardSettingsTab";
```

Adicionar o `TabsTrigger` na `TabsList` (apenas para admin):
```tsx
{isAdmin && <TabsTrigger value="tv-dashboard">TV Dashboard</TabsTrigger>}
```

Adicionar o `TabsContent` após os outros:
```tsx
{isAdmin && (
  <TabsContent value="tv-dashboard">
    <TVDashboardSettingsTab />
  </TabsContent>
)}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeded.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/TVDashboardSettingsTab.tsx src/pages/Settings.tsx
git commit -m "feat(settings): add TV Dashboard PIN configuration tab

Admin can set 4-6 digit PIN for the public /tv route.
Stored in platform_ai_config with feature='tv_dashboard_pin'.

https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG"
```

---

## Task 8: Deploy e verificação

**Arquivos:**
- Nenhum arquivo novo — deploy das edge functions

- [ ] **Step 1: Deploy da edge function `retry-failed-transcriptions`**

```bash
npx supabase functions deploy retry-failed-transcriptions --project-ref pomueweeulenslxvsxar
```

Expected: `Deployed Function retry-failed-transcriptions`

- [ ] **Step 2: Deploy do fix no `uazapi-webhook`**

```bash
npx supabase functions deploy uazapi-webhook --project-ref pomueweeulenslxvsxar
```

Expected: `Deployed Function uazapi-webhook`

- [ ] **Step 3: Configurar cron do retry no Supabase Dashboard**

Acessar Supabase Dashboard → Edge Functions → `retry-failed-transcriptions` → Schedule → Add schedule com cron `*/5 * * * *`.

- [ ] **Step 4: Testar re-transcrição manualmente**

```bash
curl -X POST https://pomueweeulenslxvsxar.supabase.co/functions/v1/retry-failed-transcriptions \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: Resposta JSON com `{ "retried": N, "found": N }` onde N ≥ 0.

- [ ] **Step 5: Verificar logs das edge functions após enviar áudio de teste**

```bash
# Aguardar ~30s após envio de áudio via WhatsApp, depois verificar logs
```

Acessar Supabase Dashboard → Logs → Edge Functions → filtrar por `transcribe-media`. Deve aparecer chamada bem-sucedida.

- [ ] **Step 6: Verificar rota `/tv` no browser**

Abrir `http://localhost:8080/tv` com `npm run dev` ativo.

Expected: Tela navy com logo GMS, 4 círculos indicadores, teclado numérico. Digitar `1234` → Dashboard TV carrega.

- [ ] **Step 7: Push e PR**

```bash
git push -u origin claude/sismais-support-system-JCMCi
```

---

## Self-Review do Plano

**Cobertura do spec:**
- ✅ Fix webhook `transcriptionUrl` com `finalMediaUrl` — Task 1
- ✅ Edge function `retry-failed-transcriptions` — Task 2
- ✅ Cron no `config.toml` — Task 2
- ✅ Lazy loading do `<audio>` — Task 3
- ✅ Skeleton `--:--` — Task 3
- ✅ Botão Re-transcrever visível — Task 3
- ✅ `TVPublicGate` com PIN — Task 4
- ✅ Rota `/tv` pública — Task 5
- ✅ Botão nova aba na Sidebar — Task 6
- ✅ Campo PIN nas Settings — Task 7
- ✅ Deploy e verificação — Task 8

**Consistência de tipos:**
- `TVPublicGate` importa `TVDashboard` como default export — verificado
- `platform_ai_config` usa `extra_config` como `Record<string, string>` — consistente com uso em `transcribe-media/index.ts` linha 69
- `FEATURE_KEY = 'tv_dashboard_pin'` usado consistentemente em Task 4 e Task 7

**Possível gap:** Se `TVDashboard` ou `useTVDashboardMetrics` chamam `useAuth()` internamente, a rota `/tv` quebrará (sem AuthContext). Task 4 Step 2 instrui a verificar isso. Se houver chamadas a `useAuth`, será necessário extrair os queries de métricas para usarem a publishable key diretamente — isso está identificado como ponto de atenção.
