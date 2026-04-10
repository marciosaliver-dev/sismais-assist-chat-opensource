# Controle de Acesso Admin + Reabertura de Tickets

**Data:** 2026-03-20
**Status:** Aprovado (rev.2 — pós code-review)
**Abordagem:** A — Aproveitar sistema de roles existente

---

## 1. Objetivo

1. Restringir páginas administrativas apenas para usuários com role `admin`
2. Mover Knowledge Base e Clientes para fora da seção admin (acessível a toda equipe)
3. Mover Agentes IA e Agentes Humanos para dentro da seção admin
4. Adicionar funcionalidade de reabrir tickets finalizados/resolvidos (só admin)
5. Classificação de roles é scoped a este projeto (não afeta outros projetos no mesmo Supabase)

---

## 2. Controle de Acesso

### 2.1 Mapa de Permissões (auth.ts)

| Permissão | admin | suporte | comercial |
|-----------|-------|---------|-----------|
| manageSettings | ✅ | ❌ | ❌ |
| manageUsers | ✅ | ❌ | ❌ |
| manageAgents | ✅ | ❌ | ❌ |
| viewReports | ✅ | ✅ | ✅ |
| viewKnowledgeBase | ✅ | ✅ | ✅ |
| viewFullKnowledgeBase | ✅ | ✅ | ❌ |
| manageKnowledgeBase | ✅ | ✅ | ❌ |
| reopenTickets | ✅ | ❌ | ❌ |
| viewAllTickets | ✅ | ✅ | ❌ |
| viewLeadTickets | ✅ | ❌ | ✅ |
| manageTickets | ✅ | ✅ | ❌ |
| changeTicketStatus | ✅ | ✅ | ❌ |
| useAICopilot | ✅ | ✅ | ❌ |

### 2.2 Rotas protegidas — mapeamento permissão→rota

| Rota | Permissão requerida |
|------|---------------------|
| `/admin/users` | `manageUsers` |
| `/admin/permissions` | `manageUsers` |
| `/admin/integrations` | `manageSettings` |
| `/ai-settings` | `manageSettings` |
| `/automations` | `manageSettings` |
| `/flow-builder` | `manageSettings` |
| `/whatsapp-instances` | `manageSettings` |
| `/agents` | `manageAgents` |
| `/human-agents` | `manageAgents` |

### 2.3 Rotas acessíveis a toda equipe

- `/knowledge` (Base de Conhecimento)
- `/clients` (Portal do Cliente)
- `/` (Dashboard)
- `/inbox`
- `/queue`
- `/kanban/:slug`
- `/contacts`
- `/macros`

### 2.4 Proteção de rotas

- Componente wrapper `<RequirePermission permission="...">` com a permissão mapeada na seção 2.2
- Redirect para `/` se o usuário não tem permissão
- Sidebar: seção "Administração" só renderiza para admin

---

## 3. Sidebar — Estrutura Reorganizada

```
── Dashboard
── Inbox
── Fila de Atendimento
── Kanban
── Clientes
── Contatos
── Base de Conhecimento
── Macros
── Relatórios
─────────────────
ADMINISTRAÇÃO (só admin)
── Agentes IA
── Agentes Humanos
── Configurações IA
── Automações
── Flow Builder
── Instâncias WhatsApp
── Usuários
── Permissões
── Integrações
```

---

## 4. Reabertura de Tickets

### 4.1 Condições

- Conversa com status `finalizado` ou `resolvido` (não `cancelado`)
- Usuário com role `admin` (permissão `reopenTickets`)

### 4.2 UI — Botão no ChatArea

- Botão "Reabrir Atendimento" aparece no banner de "somente leitura"
- Abre modal com:
  - **Motivo** (textarea, obrigatório, min 10 caracteres)
  - **Destino** (select obrigatório):
    - "Fila do orquestrador (IA redistribui)"
    - Lista de agentes humanos ativos (filtrado por `is_active && is_online`)
    - Lista de agentes IA ativos
- Estados de erro: toast com mensagem se a ação falhar; desabilitar botão durante submit

### 4.3 Tabela de eventos de reabertura (migration)

```sql
-- Tabela de eventos (source of truth)
CREATE TABLE ai_conversation_reopens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  reopened_at timestamptz NOT NULL DEFAULT now(),
  reopened_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  destination_type text NOT NULL CHECK (destination_type IN ('orchestrator', 'human', 'ai')),
  destination_id uuid, -- human_agent_id ou ai_agent_id (null se orchestrator)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cache desnormalizado para leitura rápida
ALTER TABLE ai_conversations
  ADD COLUMN reopen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_reopened_at timestamptz,
  ADD COLUMN last_reopened_by uuid REFERENCES auth.users(id);
```

### 4.4 Ação ao reabrir (via Edge Function `reopen-conversation`)

A reabertura é feita via Edge Function para **validar permissão server-side**.

1. **Validar** que o usuário autenticado tem role `admin` (query `user_roles`)
2. **Validar** que a conversa está em `finalizado` ou `resolvido`
3. **Inserir** registro em `ai_conversation_reopens`
4. **Atualizar** `ai_conversations`:
   - Se destino = "orquestrador": `status` → `aguardando`, `handler_type` → null, `assigned_agent_id` → null, `human_agent_id` → null
   - Se destino = agente humano: `status` → `em_atendimento`, `handler_type` → `human`, `human_agent_id` → id selecionado
   - Se destino = agente IA: `status` → `em_atendimento`, `handler_type` → `ai`, `assigned_agent_id` → id selecionado
   - `reopen_count` → increment +1
   - `last_reopened_at` → now()
   - `last_reopened_by` → user_id
5. **Inserir** mensagem de sistema em `ai_messages`:
   - role: `system`
   - content: "Ticket reaberto por [Nome Admin] — Motivo: [texto]"
6. **Disparar** trigger de automação `conversation_reopened` (já registrado no sistema)

---

## 5. Arquivos a modificar/criar

| Arquivo | Mudança |
|---------|---------|
| `src/types/auth.ts` | Adicionar `reopenTickets` e `manageAgents` ao mapa de permissões |
| `src/components/auth/RequirePermission.tsx` | **Novo** — wrapper de rota que valida permissão |
| `src/components/layout/Sidebar.tsx` | Reorganizar itens, seção admin condicional |
| `src/App.tsx` ou router | Wrapper `RequirePermission` nas rotas admin (seção 2.2) |
| `src/components/inbox/ChatArea.tsx` | Botão reabrir no banner read-only (só admin) |
| `src/components/inbox/ReopenTicketModal.tsx` | **Novo** — modal com motivo + destino |
| `supabase/functions/reopen-conversation/index.ts` | **Novo** — Edge Function server-side |
| Migration SQL | Tabela `ai_conversation_reopens` + campos cache em `ai_conversations` |
| `src/integrations/supabase/types.ts` | Regenerar tipos após migration |

---

## 6. Fora de escopo

- UI para editar permissões por role (futuro)
- RLS policies completas no Supabase (será tratado separadamente, exceto a Edge Function que já valida server-side)
