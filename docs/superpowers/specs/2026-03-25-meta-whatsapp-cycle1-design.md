# Meta WhatsApp Cloud API — Ciclo 1: Config + Janela 24h

**Data:** 2026-03-25
**Escopo:** Página de configuração de instâncias Meta, janela de 24h com fallback UAZAPI, indicador de canal no Inbox
**Pré-requisitos implementados:** webhook, proxy, adapter, channel-router, channel_instances, feature flags

---

## 1. Página de Configuração (Tab Meta Cloud API)

### 1.1 Onde

Expandir a página existente `/whatsapp-instances` (`src/pages/WhatsAppInstances.tsx`) com sistema de tabs:

| Tab | Conteúdo |
|-----|----------|
| **UAZAPI** | CRUD atual (sem alterações) |
| **Meta Cloud API** | Novo — CRUD de `channel_instances` com `channel_type='meta_whatsapp'` |

### 1.2 Lista de Instâncias Meta

Cards com:
- **Display Name** (editável)
- **Número** (formatado +55 XX XXXXX-XXXX)
- **Status**: connected / disconnected / error (badge colorido)
- **WABA ID** (texto monospace, copiável)
- **Phone Number ID** (texto monospace, copiável)
- **Contadores**: msgs enviadas / recebidas
- **Última mensagem**: timestamp relativo
- **Ações**: Editar, Testar Conexão, Ativar/Desativar

### 1.3 Form de Nova Instância / Edição

Campos:

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| Display Name | text | sim | Nome amigável |
| Phone Number ID | text | sim | Da Meta Developer Console |
| WABA ID | text | sim | WhatsApp Business Account ID |
| Access Token | password | sim | Token do System User (permanente) |
| Webhook Verify Token | text | sim | Token para verificação do webhook |
| Graph API Version | select | sim | Default: v21.0 |
| Kanban Board | select | não | Vincular a um board existente |

**Ação "Testar Conexão":**
- Chama `meta-whatsapp-proxy` com action `getStatus` e o instanceId
- Sucesso → atualiza status para `connected`, mostra toast verde
- Falha → mostra erro retornado pela Meta API, status `error`

### 1.4 Queries e Mutations

```typescript
// Query — listar instâncias Meta
const { data: metaInstances } = useQuery({
  queryKey: ['channel-instances', 'meta_whatsapp'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('channel_instances')
      .select('*')
      .eq('channel_type', 'meta_whatsapp')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
});

// Mutation — criar/atualizar instância
const upsertInstance = useMutation({
  mutationFn: async (instance: ChannelInstanceInsert) => {
    const { data, error } = await supabase
      .from('channel_instances')
      .upsert(instance)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['channel-instances'] });
    toast.success('Instância salva com sucesso');
  }
});

// Mutation — testar conexão
const testConnection = useMutation({
  mutationFn: async (instanceId: string) => {
    const { data, error } = await supabase.functions.invoke('meta-whatsapp-proxy', {
      body: { action: 'getStatus', instanceId }
    });
    if (error) throw error;
    return data;
  }
});
```

---

## 2. Janela de 24h

### 2.1 Regra de Negócio (Meta Business Policy)

- Após a **última mensagem do cliente**, o business tem **24 horas** para responder livremente
- Fora dessa janela, só é permitido enviar **Templates HSM** aprovados
- Cada nova mensagem do cliente **reabre** a janela por mais 24h
- Regra aplica-se APENAS a `communication_channel = 'meta_whatsapp'`
- Conversas UAZAPI não têm essa restrição

### 2.2 Backend — Tracking da Janela

**Campo novo em `ai_conversations`:**

```sql
ALTER TABLE ai_conversations
ADD COLUMN last_customer_message_at TIMESTAMPTZ;
```

**Atualização automática:**
- `channel-router.ts` → ao receber mensagem do cliente (`fromMe = false`), atualiza `last_customer_message_at = now()`

**Shared helper — `_shared/meta-24h-window.ts`:**

```typescript
export interface WindowStatus {
  isOpen: boolean;
  expiresAt: string | null;    // ISO timestamp
  remainingMs: number;         // milissegundos restantes
  requiresTemplate: boolean;   // true quando janela fechada
}

export function check24hWindow(lastCustomerMessageAt: string | null): WindowStatus {
  if (!lastCustomerMessageAt) {
    return { isOpen: false, expiresAt: null, remainingMs: 0, requiresTemplate: true };
  }
  const expiry = new Date(lastCustomerMessageAt).getTime() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = Math.max(0, expiry - now);
  return {
    isOpen: remainingMs > 0,
    expiresAt: new Date(expiry).toISOString(),
    remainingMs,
    requiresTemplate: remainingMs <= 0,
  };
}
```

**Validação no `meta-whatsapp-proxy`:**
- Antes de enviar mensagem (action `sendMessage`), verificar janela
- Se fechada e tipo não é `template` → retornar `{ error: 'WINDOW_CLOSED', requiresTemplate: true }`
- Se fechada e tipo é `template` → permitir envio

### 2.3 Frontend — Indicador no Inbox (ChatArea)

**Header da conversa Meta:**

```
┌──────────────────────────────────────────────────────────┐
│  👤 João Silva  ·  +55 77 99999-1234                     │
│  [Meta WA ✓]   [🟢 Janela aberta · expira em 14h32m]    │
└──────────────────────────────────────────────────────────┘
```

Ou quando fechada:

```
┌──────────────────────────────────────────────────────────┐
│  👤 João Silva  ·  +55 77 99999-1234                     │
│  [Meta WA]   [🟡 Janela fechada]                         │
└──────────────────────────────────────────────────────────┘
```

**Componente `MetaWindowIndicator`:**
- Props: `lastCustomerMessageAt: string | null`, `channelType: string`
- Só renderiza se `channelType === 'meta_whatsapp'`
- Timer com countdown atualizado a cada minuto
- Badge verde (aberta) ou amarelo (fechada)
- Usa `check24hWindow()` no frontend (mesma lógica, duplicada por simplicidade)

### 2.4 Frontend — Composer quando Janela Fechada

Quando `windowStatus.isOpen === false` e conversa é Meta:

```
┌──────────────────────────────────────────────────────────┐
│  ⚠️ Janela de 24h encerrada. Escolha uma opção:         │
│                                                          │
│  [📋 Enviar Template HSM]     [💬 Continuar via UAZAPI]  │
│       (em breve)                                         │
└──────────────────────────────────────────────────────────┘
```

- Campo de texto **desabilitado** (cinza, não interativo)
- Banner amarelo com aviso
- **Botão "Enviar Template HSM"**: desabilitado com tooltip "Disponível em breve" (Ciclo 2)
- **Botão "Continuar via UAZAPI"**: ativo — inicia fluxo de troca de canal

### 2.5 Fluxo "Continuar via UAZAPI"

**Passo a passo:**

1. Operador clica "Continuar via UAZAPI"
2. Modal abre com seletor de instâncias UAZAPI ativas
3. Operador seleciona instância
4. Sistema verifica se já existe conversa UAZAPI com o mesmo número do contato:
   - **Se existe**: redireciona para essa conversa
   - **Se não existe**: cria nova conversa com:
     - `communication_channel = 'uazapi'`
     - `channel_instance_id = instanceId selecionado`
     - `channel_chat_id = número do contato (formato UAZAPI JID)`
     - `related_conversation_id = id da conversa Meta original` (campo novo)
5. Redireciona operador para a conversa UAZAPI no Inbox
6. Na conversa UAZAPI, banner informativo: "Conversa iniciada a partir do canal Meta WhatsApp"

**Quando o cliente responde na Meta:**
- O webhook recebe a mensagem normalmente
- `channel-router` atualiza `last_customer_message_at` → janela reabre
- A conversa Meta volta ao Inbox como ativa (já acontece naturalmente)
- Operador volta a responder pela Meta (comportamento padrão do Inbox — a conversa mais recente aparece no topo)

### 2.6 Campo `related_conversation_id`

```sql
ALTER TABLE ai_conversations
ADD COLUMN related_conversation_id UUID REFERENCES ai_conversations(id);
```

- Permite rastrear que uma conversa UAZAPI foi criada como fallback de uma conversa Meta
- Bidirecional: pode ser setado em ambas as conversas
- Usado para exibir banner informativo e facilitar navegação entre conversas do mesmo contato

---

## 3. Indicador de Canal no Inbox

### 3.1 Lista de Conversas (Sidebar)

Cada item na lista de conversas mostra um ícone pequeno indicando o canal:

| Canal | Ícone | Cor |
|-------|-------|-----|
| UAZAPI | `smartphone` (Material) | navy |
| Meta WhatsApp | `verified` (Material) | verde (#16A34A) |

Posição: ao lado do nome do contato, alinhado à direita do timestamp.

### 3.2 Filtro por Canal

Adicionar filtro dropdown na sidebar do Inbox:

| Opção | Filtro |
|-------|--------|
| Todos os canais | sem filtro |
| UAZAPI | `communication_channel = 'uazapi'` ou `IS NULL` |
| Meta WhatsApp | `communication_channel = 'meta_whatsapp'` |

### 3.3 Header da Conversa

Badge ao lado do nome:
- `[UAZAPI]` — badge navy small
- `[Meta WA ✓]` — badge verde small (✓ indica API oficial)

---

## 4. Migrations Necessárias

```sql
-- 1. Campo para tracking da janela de 24h
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;

-- 2. Campo para conversas relacionadas (fallback UAZAPI)
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS related_conversation_id UUID REFERENCES ai_conversations(id);

-- 3. Índice para busca de conversas por número + canal
CREATE INDEX IF NOT EXISTS idx_conversations_channel_chat
ON ai_conversations(channel_chat_id, communication_channel);

-- 4. Índice para janela de 24h (queries de conversas Meta ativas)
CREATE INDEX IF NOT EXISTS idx_conversations_last_customer_msg
ON ai_conversations(last_customer_message_at)
WHERE communication_channel = 'meta_whatsapp';
```

---

## 5. Arquivos a Criar/Modificar

### Criar
| Arquivo | Propósito |
|---------|-----------|
| `src/components/whatsapp/MetaInstancesTab.tsx` | Tab Meta na página de instâncias |
| `src/components/whatsapp/MetaInstanceCard.tsx` | Card de instância Meta |
| `src/components/whatsapp/MetaInstanceForm.tsx` | Form criar/editar instância |
| `src/components/inbox/MetaWindowIndicator.tsx` | Indicador janela 24h |
| `src/components/inbox/WindowClosedComposer.tsx` | Composer alternativo quando janela fechada |
| `src/components/inbox/SwitchToUazapiDialog.tsx` | Modal seletor de instância UAZAPI |
| `src/components/inbox/ChannelBadge.tsx` | Badge de canal reutilizável |
| `src/hooks/useMetaWindow.ts` | Hook para status da janela 24h |
| `src/hooks/useChannelInstances.ts` | Hook para queries de channel_instances |
| `supabase/functions/_shared/meta-24h-window.ts` | Shared helper janela 24h |
| `supabase/migrations/2026XXXX_meta_24h_window.sql` | Migration campos novos |

### Modificar
| Arquivo | Mudança |
|---------|---------|
| `src/pages/WhatsAppInstances.tsx` | Adicionar sistema de tabs (UAZAPI / Meta) |
| `src/components/inbox/ChatArea.tsx` | Integrar MetaWindowIndicator + WindowClosedComposer + ChannelBadge |
| `supabase/functions/_shared/channel-router.ts` | Atualizar `last_customer_message_at` ao receber msg |
| `supabase/functions/meta-whatsapp-proxy/index.ts` | Validar janela 24h antes de enviar |

---

## 6. Fora de Escopo (Ciclo 2)

- Templates HSM (listar, selecionar, enviar)
- Rate limiting (80 msg/s, tiers)
- Billing tracking (user-initiated vs business-initiated)
- Mensagens interativas (botões, listas) — o backend já suporta, mas a UI não
- CSAT adaptado para Meta
- Gerenciamento de templates (criar, submeter para aprovação)
