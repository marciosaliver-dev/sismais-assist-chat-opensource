# Spec: Fix Transcrição de Áudio + UX Áudio + Dashboard TV com PIN

**Data:** 2026-03-26
**Branch:** `claude/sismais-support-system-JCMCi`

---

## Problema

Três melhorias independentes identificadas:

1. **Transcrição de áudio quebrada** — `transcribe-media` nunca é invocado (confirmado nos logs). Causa raiz: quando o download da mídia falha no `uazapi-webhook`, `storedMediaUrl` fica vazio e `mediaUrl` também não está disponível, resultando em `transcriptionUrl = ""`. O branch `else if` marca a mensagem como `[Áudio - transcrição falhou]` imediatamente, sem nem tentar transcrever.

2. **UX ruim no player de áudio** — O elemento `<audio>` usa `preload="metadata"`, o que faz uma requisição de rede imediata ao renderizar. Em listas com muitos áudios, isso causa lentidão. O botão "Re-transcrever" é minúsculo e pouco visível.

3. **Dashboard TV requer login** — Não é possível abrir em nova aba nem exibir em TV/monitor de equipe sem estar logado. Falta opção de acesso simplificado por PIN.

---

## Solução

### Parte 1 — Fix Transcrição de Áudio

#### 1A. Edge function `retry-failed-transcriptions` (nova)

Job de retry automático que roda via cron a cada 5 minutos:

- Busca `ai_messages` onde:
  - `content IN ('[Áudio - transcrição falhou]', '[Áudio]', '[audio]', '[ptt]', '[Áudio transcrito] ')`  **E**
  - `media_url IS NOT NULL` **E**
  - `media_type IN ('audio', 'ptt')` **E**
  - `created_at > NOW() - INTERVAL '24 hours'` (não reprocessar mensagens antigas indefinidamente)
- Para cada mensagem encontrada, invoca `transcribe-media` com `message_id`, `conversation_id`, `media_url`, `media_type`
- Limita a 20 mensagens por execução para não sobrecarregar

**Arquivo:** `supabase/functions/retry-failed-transcriptions/index.ts`

#### 1B. Fix no `uazapi-webhook`

No bloco da linha 1559, adicionar fallback: quando `transcriptionUrl` está vazio mas `finalMediaUrl` está disponível (set na linha 772), usar `finalMediaUrl` como URL de transcrição:

```
// Atual
const transcriptionUrl = storedMediaUrl || (mediaUrl && mediaUrl.startsWith("http") ? mediaUrl : "");

// Novo
const transcriptionUrl = storedMediaUrl
  || (mediaUrl && mediaUrl.startsWith("http") ? mediaUrl : "")
  || (finalMediaUrl && finalMediaUrl.startsWith("http") ? finalMediaUrl : "");
```

**Nota:** `finalMediaUrl = storedMediaUrl || mediaUrl || ""` — já existente. O fix garante que o fallback de CDN preservado no upload failure (linha 758-761) seja usado na transcrição.

#### 1C. Cron job no `config.toml`

Registrar o cron de `retry-failed-transcriptions` a cada 5 minutos no `supabase/config.toml`.

---

### Parte 2 — UX do Player de Áudio

#### 2A. Lazy loading do `<audio>`

Em `ChatArea.tsx`, no bloco de renderização de `audio`/`ptt`:

- Trocar `preload="metadata"` por `preload="none"`
- Só montar o `<audio>` no DOM quando o usuário clicar play pela primeira vez (state `audioRequested`)
- Enquanto `audioRequested = false`, mostrar o player visual normalmente mas sem o elemento `<audio>`
- Quando play é clicado: `setAudioRequested(true)` → monta `<audio>` → chama `audio.play()` no `useEffect` quando ref estiver disponível

#### 2B. Skeleton de duração

Quando `audioDuration === 0` (não carregou ainda), mostrar `--:--` em vez de `0:00` para deixar claro que está carregando.

#### 2C. Botão Re-transcrever mais visível

Trocar o botão inline tiny por um componente `Button` shadcn/ui com variante `outline`, tamanho `sm`, ícone `RefreshCw`, e texto "Re-transcrever". Manter estado `disabled` durante o loading com `Loader2` spinner.

---

### Parte 3 — Dashboard TV com Nova Aba + Acesso por PIN

#### 3A. Botão "Abrir em nova aba" na Sidebar

Em `Sidebar.tsx`, no item "Dashboard TV" (linha 133), adicionar um segundo botão `ExternalLink` à direita que faz `window.open('/tv', '_blank')` sem navegação interna.

Estrutura do item especial:
```tsx
// Item com ação de nova aba ao lado do link normal
<div className="flex items-center justify-between w-full group">
  <Link to="/tv-dashboard">...</Link>
  <button onClick={() => window.open('/tv', '_blank')} title="Abrir em nova aba">
    <ExternalLink className="w-3.5 h-3.5" />
  </button>
</div>
```

#### 3B. Rota pública `/tv`

Nova rota em `App.tsx` **sem** `ProtectedRoute`:
```tsx
<Route path="/tv" element={<TVPublicGate />} />
```

#### 3C. Página `TVPublicGate`

Nova página `src/pages/TVPublicGate.tsx`:

**Estados:**
- `unlocked = false` → mostra tela de PIN
- `unlocked = true` → renderiza `<TVDashboard />` diretamente

**Fluxo de PIN:**
1. Carrega PIN configurado via query `platform_ai_config` onde `feature = 'tv_dashboard_pin'` usando a **publishable key** (não requer autenticação). Se não configurado, PIN padrão = `1234`.
2. Usuário digita PIN via teclado numérico na tela (4 dígitos)
3. Compara com PIN configurado
4. Se correto: salva `{ unlocked: true, exp: Date.now() + 8h }` em `localStorage['tv_pin_session']` e seta `unlocked = true`
5. Na próxima visita: checa `localStorage` antes de mostrar tela de PIN

**UI da tela de PIN:**
- Fundo `#10293F` (navy) fullscreen
- Logo GMS centralizado
- Título "Dashboard TV" em branco
- 4 círculos indicadores de dígito (preenchidos conforme o usuário digita)
- Teclado numérico 3x4 (botões 0-9 + backspace) em grade, estilo GMS
- Sem campo de texto (apenas cliques no teclado numérico)

#### 3D. Configuração do PIN nas Settings

Em `src/pages/Settings.tsx` (ou aba de configuração existente), adicionar campo para configurar o PIN do Dashboard TV. Salvar em `platform_ai_config` com `feature = 'tv_dashboard_pin'` e o PIN no campo `extra_config.pin`.

**Nota de segurança:** O PIN é proteção de conveniência (impede acesso acidental), não segurança forte. Os dados do TVDashboard são métricas internas de atendimento — risco aceitável. A publishable key do Supabase só permite `SELECT` com RLS ativa.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/retry-failed-transcriptions/index.ts` | Criar |
| `supabase/config.toml` | Modificar — adicionar cron |
| `supabase/functions/uazapi-webhook/index.ts` | Modificar — fix transcriptionUrl |
| `src/components/inbox/ChatArea.tsx` | Modificar — lazy audio + botão re-transcrever |
| `src/components/layout/Sidebar.tsx` | Modificar — botão nova aba TV |
| `src/pages/TVPublicGate.tsx` | Criar |
| `src/App.tsx` | Modificar — rota `/tv` pública |
| `src/pages/Settings.tsx` | Modificar — campo PIN TV |

---

## Não está no escopo

- Alterar o pipeline de decryption HKDF do UAZAPI (complexidade alta, causa secundária)
- Transcrição de vídeos
- Autenticação robusta para o Dashboard TV (PIN é suficiente para o caso de uso)
- Re-estilização completa do player de áudio

---

## Sequência de Implementação

1. Fix `uazapi-webhook` (1 linha, impacto imediato)
2. Edge function `retry-failed-transcriptions` + cron
3. UX do áudio em `ChatArea.tsx`
4. `TVPublicGate` + rota `/tv`
5. Botão nova aba na Sidebar
6. Campo PIN nas Settings
7. Deploy + verificação nos logs
