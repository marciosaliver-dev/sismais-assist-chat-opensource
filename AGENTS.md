# Sismais AI — Helpdesk Inteligente

## Visão Geral do Projeto

Plataforma de atendimento ao cliente com IA multi-agente integrada ao WhatsApp via UAZAPI. Combina agentes de IA com suporte humano, automações, RAG (base de conhecimento), orquestração inteligente e integração com os sistemas Sismais GL e Sismais Admin.

**Repositório:** `marciosaliver-dev/sismais-assist-chat`
**Branch de desenvolvimento:** `claude/sismais-support-system-JCMCi`
**NUNCA** faça push para `main` ou `master`.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | TailwindCSS + shadcn/ui (Radix UI) |
| Estado servidor | TanStack React Query v5 |
| Roteamento | React Router v6 |
| Backend/DB | Supabase (PostgreSQL + RLS) |
| Edge Functions | Deno (TypeScript) — 44 funções |
| IA/LLM | OpenRouter (Gemini 2.0 Flash) + OpenAI (embeddings) |
| WhatsApp | UAZAPI (self-hosted) |

---

## Estrutura de Diretórios

```
src/
├── pages/              # Rotas da aplicação (31 páginas)
├── components/         # Componentes React reutilizáveis
│   ├── agents/         # Agentes IA: cards, formulário, tabs
│   ├── clients/        # Gestão de clientes helpdesk
│   ├── conversation/   # Chat e inbox
│   ├── kanban/         # Quadro Kanban (tickets)
│   ├── layout/         # Sidebar, Header, MainLayout
│   └── ui/             # shadcn/ui base components
├── hooks/              # Custom React hooks
├── integrations/
│   └── supabase/
│       ├── client.ts   # Supabase client
│       └── types.ts    # Tipos gerados automaticamente (NÃO editar)
├── contexts/           # AuthContext, etc.
└── lib/                # Utilitários (cn, etc.)

supabase/
├── functions/          # Edge Functions Deno (44 funções)
│   ├── agent-executor/         # Executa agentes IA com RAG
│   ├── orchestrator/           # Roteia mensagens para agentes
│   ├── platform-ai-assistant/  # Configurador IA conversacional
│   ├── uazapi-webhook/         # Recebe webhooks WhatsApp
│   ├── uazapi-proxy/           # Proxy para API UAZAPI
│   ├── sismais-admin-proxy/    # Integração Sismais Admin
│   └── sismais-client-lookup/  # Busca clientes Sismais GL
└── config.toml
```

---

## Rotas da Aplicação

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Dashboard | Métricas e visão geral |
| `/inbox` | Inbox | Conversas WhatsApp |
| `/queue` | Queue | Fila de atendimento |
| `/kanban/:slug` | KanbanPage | Quadro Kanban por board |
| `/clients` | Clients | Lista clientes Sismais Admin |
| `/clients/:id` | ClientDetail | Detalhe do cliente helpdesk |
| `/contacts` | Contacts | Contatos UAZAPI |
| `/agents` | Agents | Gerenciar agentes IA (redesenhado) |
| `/agents/playground/:id` | AgentPlayground | Testar agente |
| `/ai-configurator` | AIConfigurator | Chat IA para configurar sistema |
| `/human-agents` | HumanAgents | Agentes humanos |
| `/ai-consumption` | AIConsumptionDashboard | Consumo de tokens |
| `/ai-settings` | AISettings | Config global de IA |
| `/automations` | Automations | Automações |
| `/flow-builder` | FlowBuilder | Editor visual de fluxos |
| `/knowledge` | Knowledge | Base de conhecimento |
| `/macros` | Macros | Respostas rápidas |
| `/whatsapp-instances` | WhatsAppInstances | Instâncias UAZAPI |
| `/settings` | Settings | Configurações gerais |
| `/admin/users` | AdminUsers | Usuários (usa human_agents) |
| `/admin/permissions` | AdminPermissions | Permissões |
| `/admin/integrations` | AdminIntegrations | Integrações |

---

## Banco de Dados — Tabelas Principais

### Agentes e IA
- **`ai_agents`** — Configurações de agentes (name, specialty, system_prompt, model, tools, rag_enabled, support_config JSON)
- **`ai_conversations`** — Conversas com status, handler_type (ai/human), agent_id
- **`ai_messages`** — Mensagens com role, content, confidence, cost_usd
- **`ai_knowledge_base`** — Documentos com embeddings vetoriais para RAG
- **`ai_automations`** — Automações com trigger_type e actions

### WhatsApp / UAZAPI
- **`uazapi_instances`** — Instâncias WhatsApp (api_url, api_token)
- **`uazapi_chats`** — Chats/conversas WhatsApp
- **`uazapi_messages`** — Mensagens individuais

### Helpdesk
- **`helpdesk_clients`** — Clientes locais do helpdesk
- **`helpdesk_client_contacts`** — Contatos por cliente
- **`helpdesk_client_contracts`** — Contratos
- **`helpdesk_client_annotations`** — Anotações
- **`human_agents`** — Agentes humanos (name, email, is_active, is_online, status)

### Kanban
- **`kanban_boards`** — Boards com slug, name, color, icon
- **`kanban_stages`** — Colunas do Kanban
- **`ticket_categories`**, **`ticket_modules`** — Metadados de tickets

### Sistema
- **`macros`** — Templates de mensagem (name, message, color, is_active)
- **`incoming_webhooks`** — Webhooks de entrada configurados
- **`user_roles`** — Papéis dos usuários (admin, agent, etc.)

---

## Especialidades de Agentes IA

| Specialty | Papel | Descrição |
|-----------|-------|-----------|
| `triage` | Triagem | Direciona para outros agentes |
| `support` | Atendimento | Suporte técnico ao cliente |
| `financial` | Atendimento | Cobranças e pagamentos |
| `sales` / `sdr` | Atendimento | Qualificação de leads |
| `copilot` | Copiloto | Auxilia agentes humanos |
| `analytics` | Analítico | Gera métricas e relatórios |

---

## Pipeline de Mensagens

```
WhatsApp → uazapi-webhook → process-incoming-message
                                    ↓
                              orchestrator (escolhe agente via LLM)
                                    ↓
                           agent-executor (RAG + LLM + tools)
                                    ↓
                    confidence < threshold → escalate → human_agent
```

---

## Variáveis de Ambiente

**Frontend** (`.env`):
```
VITE_SUPABASE_URL=https://pomueweeulenslxvsxar.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

**Edge Functions** (secrets no Supabase):
- `OPENROUTER_API_KEY` — LLM routing
- `OPENAI_API_KEY` — Embeddings
- `LOVABLE_API_KEY` — Platform AI assistant gateway
- `SUPABASE_SERVICE_ROLE_KEY` — Admin DB access
- `SISMAIS_GL_SUPABASE_URL` + `SISMAIS_GL_SERVICE_ROLE_KEY`
- `SISMAIS_ADMIN_SUPABASE_URL` + `SISMAIS_ADMIN_SERVICE_ROLE_KEY`
- `UAZAPI_SUBDOMAIN`, `UAZAPI_TOKEN`, `UAZAPI_INSTANCE_ID`

---

## Padrões de Desenvolvimento

### Componentes React
- Componentes funcionais com TypeScript
- Props tipadas com interfaces locais
- Queries via `useQuery` / mutations via `useMutation` do React Query
- Invalidar queries relevantes após mutações: `qc.invalidateQueries({ queryKey: [...] })`
- Toast via `import { toast } from 'sonner'`
- Ícones via `lucide-react`
- Classes CSS via `cn()` de `@/lib/utils`

### Supabase
- Cliente: `import { supabase } from '@/integrations/supabase/client'`
- Tipos: `import type { Tables, TablesInsert } from '@/integrations/supabase/types'`
- Chamar edge function: `supabase.functions.invoke('nome-da-funcao', { body: {...} })`

### Edge Functions (Deno)
- Importar supabase-js: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"`
- Sempre incluir `corsHeaders` no response
- Handler: `Deno.serve(async (req) => { ... })`
- Verificar `req.method === "OPTIONS"` para CORS preflight

### Git
- Branch: `claude/sismais-support-system-JCMCi`
- Push: `git push -u origin claude/sismais-support-system-JCMCi`
- Commit: mensagem descritiva + `https://claude.ai/code/session_013pLozXcUjVgY43cnkMJTnG`
- **NUNCA** commitar `.env` ou segredos

---

## Convenções de UI

- **Tema**: dark/light via CSS variables (sistema)
- **Cores primárias**: `text-primary`, `bg-primary`, `border-primary`
- **Cards**: `rounded-xl border border-border bg-card`
- **Loading**: componente `<Spinner />` de `@/components/ui/spinner`
- **Formulários**: shadcn/ui components (Input, Select, Textarea, Label, Switch)
- **Dialogs**: shadcn/ui Dialog com `max-w-lg max-h-[90vh] overflow-y-auto`
- **Tabelas**: shadcn/ui Table ou `<table>` manual com `border-b border-border`

---

## Estado Atual do Projeto (Fev 2026)

### Implementado ✅
- Pipeline completo WhatsApp → IA → resposta
- Sistema de agentes multi-papel com orquestrador
- RAG com embeddings e busca semântica
- Kanban board com drag-and-drop
- Integração Sismais GL + Admin
- Macros page com CRUD
- Configurador IA conversacional (`/ai-configurator`)
- Rotas admin registradas e conectadas a dados reais

### Em desenvolvimento / parcial
- Copilot e Analytics (novos tipos de agente — lógica de backend pendente)
- SLA tracking (função existe, UI pendente)
- Analytics dashboard (generate-report function existe, UI pendente)

---

## Comandos Úteis

```bash
npm run dev          # Inicia dev server (porta 8080)
npm run build        # Build de produção
npm run lint         # ESLint

git status           # Ver arquivos modificados
git add -p           # Staging seletivo
git push -u origin claude/sismais-support-system-JCMCi
```

---

## UX/UI Specialist — Sismais Tecnologia (GMS)

Especialista sênior em UX/UI da Sismais Tecnologia, criador do produto **GMS — Gestão Mais Simples**. Toda interface gerada deve seguir obrigatoriamente a identidade visual oficial e os princípios de simplicidade do GMS.

> **Regra de ouro:** Nenhum componente, tela ou elemento visual deve ser entregue sem respeitar a paleta, a tipografia e as diretrizes da Sismais. Menos é mais — cada elemento deve ter propósito claro.

---

### 0. PRINCÍPIOS DE DESIGN GMS

1. **Simplicidade primeiro** — remova tudo que não serve à ação do usuário
2. **Hierarquia clara** — o usuário deve saber onde está e o que fazer sem ler nada
3. **Consistência absoluta** — mesmo componente = mesmo estilo em toda tela
4. **Feedback imediato** — toda ação tem resposta visual (hover, focus, loading, sucesso)
5. **Mobile-friendly** — layouts funcionam em qualquer viewport acima de 320px
6. **Acessível por padrão** — contraste WCAG AA mínimo, foco visível, aria correto

---

### 1. IDENTIDADE VISUAL — PALETA OFICIAL

#### Cores primárias

| Token | HEX | Uso principal |
|---|---|---|
| `--navy` | `#10293F` | Topbar, sidebar, headers escuros, backgrounds de painel |
| `--cyan` | `#45E5E5` | CTAs, elementos ativos, tabs ativas, destaques interativos |
| `--yellow` | `#FFB800` | Alertas, urgência, badges de prioridade, avisos |

#### Cores neutras e funcionais

| Token | HEX | Uso |
|---|---|---|
| `--white` | `#FFFFFF` | Fundos de card, superfícies limpas |
| `--bg` | `#F8FAFC` | Fundo geral da área de conteúdo |
| `--gray-100` | `#F5F5F5` | Fundos alternativos, hover sutil |
| `--gray-200` | `#E5E5E5` | Bordas padrão de cards e inputs |
| `--gray-300` | `#CCCCCC` | Bordas de inputs, separadores |
| `--gray-500` | `#666666` | Textos secundários, placeholders |
| `--gray-700` | `#444444` | Textos de suporte |
| `--gray-900` | `#333333` | Textos de corpo principais |
| `--error` | `#DC2626` | Erros, prioridade alta, estados inválidos |
| `--success` | `#16A34A` | Confirmações, status verde |
| `--info` | `#2563EB` | Informações, status azul |
| `--purple` | `#7C3AED` | Tags especiais, categorias |

#### Regras de contraste — NUNCA violar

```
cyan (#45E5E5)   → texto SEMPRE navy (#10293F)  — nunca branco
yellow (#FFB800) → texto SEMPRE navy (#10293F)  — nunca branco
navy (#10293F)   → texto SEMPRE branco (#FFFFFF) — nunca navy sobre navy
sombras          → SEMPRE rgba(16,41,63,X)       — nunca rgba(0,0,0,X)
```

---

### 2. TOKENS CSS COMPLETOS

```css
:root {
  /* MARCA */
  --navy:          #10293F;
  --navy-hover:    #1a3d5c;
  --navy-light:    #1e3f5a;
  --cyan:          #45E5E5;
  --cyan-hover:    #2ecece;
  --cyan-dark:     #28a8a8;
  --cyan-light:    #E8F9F9;
  --yellow:        #FFB800;
  --yellow-hover:  #e6a600;

  /* NEUTROS */
  --white:         #FFFFFF;
  --bg:            #F8FAFC;
  --gray-100:      #F5F5F5;
  --gray-200:      #E5E5E5;
  --gray-300:      #CCCCCC;
  --gray-500:      #666666;
  --gray-700:      #444444;
  --gray-900:      #333333;

  /* SEMÂNTICAS */
  --error:         #DC2626;
  --error-bg:      #FEF2F2;
  --success:       #16A34A;
  --success-bg:    #F0FDF4;
  --warning:       var(--yellow);
  --warning-bg:    #FFFBEB;
  --info:          #2563EB;
  --info-bg:       #EFF6FF;
  --purple:        #7C3AED;

  /* TIPOGRAFIA */
  --font-ui:       'Poppins', 'Inter', system-ui, sans-serif;
  --font-body:     'Inter', system-ui, sans-serif;
  --text-xs:       0.75rem;
  --text-sm:       0.8125rem;
  --text-base:     0.9375rem;
  --text-lg:       1.0625rem;
  --text-xl:       1.25rem;
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* ESPAÇAMENTO (escala 4px) */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;

  /* BORDER RADIUS */
  --r-sm:   4px;
  --r-md:   6px;
  --r-lg:   8px;
  --r-xl:   12px;
  --r-full: 9999px;

  /* SOMBRAS — tom navy */
  --sh-sm:   0 1px 2px rgba(16,41,63,0.06);
  --sh-md:   0 4px 6px -1px rgba(16,41,63,0.1), 0 2px 4px -1px rgba(16,41,63,0.06);
  --sh-lg:   0 10px 15px -3px rgba(16,41,63,0.1), 0 4px 6px -2px rgba(16,41,63,0.05);
  --sh-cyan: 0 4px 14px rgba(69,229,229,0.3);

  /* TRANSIÇÕES */
  --tr-fast: 150ms ease;
  --tr-base: 200ms ease;
  --tr-slow: 300ms ease;
}
```

---

### 3. HTML vs REACT — QUANDO USAR CADA UM

| Usar HTML puro | Usar React/JSX |
|---|---|
| Telas estáticas de demonstração | Telas com estado complexo |
| Protótipos e mockups rápidos | Dashboard com dados dinâmicos |
| Kanban, modais, formulários simples | Componentes reutilizáveis |
| Quando o usuário pede `.html` | Quando o usuário pede `.jsx`/`.tsx` |
| Telas de referência / design | Apps em produção |

**Padrão GMS:** na dúvida, use **HTML + CSS** para telas e **React** para componentes.

---

### 4. SETUP HTML — CABEÇALHO PADRÃO

Todo arquivo `.html` Sismais começa com este `<head>`:

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GMS — [Nome da Tela]</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL@20..48,300..700,0..1" rel="stylesheet">
  <style>
    /* Reset mínimo */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #F8FAFC; color: #333; }

    /* Ícones Material */
    .icon { font-family: 'Material Symbols Rounded'; font-size: 20px;
            font-style: normal; line-height: 1; user-select: none; }
    .icon-sm  { font-size: 16px; }
    .icon-lg  { font-size: 24px; }
    .icon-xl  { font-size: 32px; }
  </style>
</head>
```

#### Ícones Material Symbols mais usados no GMS

```
dashboard        → dashboard
support_agent    → atendimento / suporte
inbox            → caixa de entrada
task_alt         → tarefa concluída
edit_note        → editar
person           → usuário / cliente
group            → equipe
notifications    → notificações
search           → busca
filter_list      → filtros
add              → adicionar
close            → fechar
expand_more      → expandir / dropdown
chevron_right    → navegar / breadcrumb
drag_indicator   → arrastar
priority_high    → prioridade alta
warning          → aviso / alerta
check_circle     → sucesso
cancel           → erro / cancelar
schedule         → prazo / tempo
label            → tag / categoria
attach_file      → anexo
send             → enviar
smart_toy        → IA / assistente
auto_fix_high    → melhorar / AI
psychology       → contexto / AI
```

---

### 5. TOPBAR — COMPONENTE OBRIGATÓRIO

A topbar navy é o elemento de identidade do GMS. **Sempre** presente em telas de sistema.

```html
<header class="topbar">
  <div class="tb-logo">
    <span class="tb-logo-mark">GMS</span>
    <span class="tb-logo-text">Gestão Mais Simples</span>
  </div>
  <nav class="tb-breadcrumb">
    <span>Atendimento</span>
    <span class="icon icon-sm">chevron_right</span>
    <span class="tb-bc-active">Kanban</span>
  </nav>
  <div class="tb-actions">
    <button class="tb-icon-btn">
      <span class="icon">notifications</span>
      <span class="tb-badge">3</span>
    </button>
    <div class="tb-user">
      <span class="tb-avatar">MS</span>
      <span>Marcio S.</span>
      <span class="icon icon-sm">expand_more</span>
    </div>
  </div>
</header>
```

```css
.topbar {
  height: 52px;
  background: #10293F;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 0 rgba(255,255,255,0.08);
}

/* Logo */
.tb-logo { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tb-logo-mark {
  background: #45E5E5; color: #10293F;
  font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 13px;
  padding: 3px 7px; border-radius: 4px; letter-spacing: 0.5px;
}
.tb-logo-text { color: #fff; font-family: 'Poppins', sans-serif;
                font-size: 13px; font-weight: 500; opacity: 0.9; }

/* Breadcrumb */
.tb-breadcrumb {
  display: flex; align-items: center; gap: 4px; flex: 1;
  font-size: 13px; color: rgba(255,255,255,0.55);
}
.tb-breadcrumb .icon { color: rgba(255,255,255,0.3); }
.tb-bc-active { color: #fff; font-weight: 500; }

/* Ações */
.tb-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tb-icon-btn {
  position: relative; background: transparent; border: none; cursor: pointer;
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.7); transition: background 150ms;
}
.tb-icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.tb-badge {
  position: absolute; top: 6px; right: 6px;
  background: #FFB800; color: #10293F; font-size: 9px; font-weight: 700;
  min-width: 14px; height: 14px; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center; padding: 0 3px;
}
.tb-user {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  padding: 4px 8px; border-radius: 8px; transition: background 150ms;
  color: rgba(255,255,255,0.85); font-size: 13px;
}
.tb-user:hover { background: rgba(255,255,255,0.1); }
.tb-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: #45E5E5; color: #10293F;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
```

---

### 6. LAYOUT DE TELA — ESTRUTURAS PADRÃO

#### 6.1 Layout Kanban / Board

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR (navy, 52px, sticky)                                        │
├─────────────────────────────────────────────────────────────────────┤
│  BOARD HEADER: título + filtros + btn "Nova Tarefa"                 │
├────────┬──────────┬───────────┬──────────┬────────────┬────────────┤
│ ABERTO │EM ANDAMENTO│ AGUARDANDO│ RESOLVIDO │ FECHADO    │ SIDE PANEL │
│ cyan   │ navy/cyan │ yellow    │ green     │ gray       │ (slide-in) │
│ cards  │  cards    │  cards    │  cards    │  cards     │            │
└────────┴──────────┴───────────┴──────────┴────────────┴────────────┘
```

```css
.board-layout { display: flex; height: calc(100vh - 52px); overflow: hidden; }
.board-cols { display: flex; gap: 12px; padding: 16px; overflow-x: auto; flex: 1; }

/* Coluna */
.col {
  min-width: 260px; max-width: 300px; flex-shrink: 0;
  background: #F8FAFC; border-radius: 8px;
  border: 1px solid #E5E5E5;
  display: flex; flex-direction: column;
}
.col-head {
  padding: 12px 14px 10px;
  border-bottom: 3px solid transparent;
  display: flex; align-items: center; justify-content: space-between;
}

/* Cores de indicador por coluna */
.col[data-col="aberto"]     .col-head { border-bottom-color: #45E5E5; }
.col[data-col="andamento"]  .col-head { border-bottom-color: #2563EB; }
.col[data-col="aguardando"] .col-head { border-bottom-color: #FFB800; }
.col[data-col="resolvido"]  .col-head { border-bottom-color: #16A34A; }
.col[data-col="fechado"]    .col-head { border-bottom-color: #666666; }
```

#### Cores de Coluna — Tabela Completa

| Coluna | Cor da borda | Hex |
|---|---|---|
| Aberto / Novo | cyan | `#45E5E5` |
| Em Atendimento | azul | `#2563EB` |
| Aguardando Cliente | amarelo | `#FFB800` |
| Aguardando Terceiro | laranja | `#EA580C` |
| Resolvido | verde | `#16A34A` |
| Fechado / Cancelado | cinza | `#666666` |
| Escalado / Urgente | vermelho | `#DC2626` |
| Em Análise | roxo | `#7C3AED` |

---

### 7. CARD DE KANBAN

```html
<div class="card p-alta">
  <div class="card-top">
    <span class="card-id">#1234</span>
    <span class="badge badge-error-sm">Alta</span>
  </div>
  <div class="card-title">Erro ao fazer login no sistema</div>
  <div class="card-meta">
    <span class="card-tag">Acesso</span>
    <span class="card-tag">Login</span>
  </div>
  <div class="card-footer">
    <span class="card-avatar">JS</span>
    <span class="card-date">
      <span class="icon icon-sm">schedule</span>
      há 2h
    </span>
  </div>
</div>
```

```css
.card {
  background: #fff; border: 1px solid #E5E5E5; border-radius: 8px;
  padding: 12px 12px 12px 14px; cursor: pointer;
  transition: all 150ms ease; position: relative;
  border-left: 3px solid transparent;
}
.card:hover { box-shadow: 0 4px 12px rgba(16,41,63,0.1); transform: translateY(-1px); }
.card:focus-visible { outline: 2px solid #45E5E5; outline-offset: 2px; }

/* Prioridade — borda esquerda */
.card.p-alta    { border-left-color: #DC2626; }
.card.p-media   { border-left-color: #FFB800; }
.card.p-baixa   { border-left-color: #16A34A; }
.card.p-critica { border-left-color: #7C3AED; }

.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.card-id  { font-size: 11px; color: #666; font-family: monospace; }
.card-title { font-size: 13px; font-weight: 500; color: #10293F; margin-bottom: 8px; line-height: 1.4; }
.card-meta  { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.card-tag {
  font-size: 10px; font-weight: 500; color: #444;
  background: #F5F5F5; border: 1px solid #E5E5E5;
  padding: 1px 6px; border-radius: 9999px;
}
.card-footer { display: flex; align-items: center; justify-content: space-between; }
.card-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  background: #10293F; color: #45E5E5;
  font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.card-date { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #888; }
```

---

### 8. SIDE PANEL (Painel Lateral)

Painel slide-in que abre ao clicar em um card do kanban.

```css
/* Side Panel */
.side-panel {
  width: 380px; flex-shrink: 0;
  background: #fff; border-left: 1px solid #E5E5E5;
  display: flex; flex-direction: column;
  transition: width 300ms ease;
}
.side-panel.closed { width: 0; overflow: hidden; }

/* Banner de aviso */
.panel-banner {
  background: #FFFBEB; border-bottom: 1px solid #FFB800;
  padding: 8px 14px; font-size: 12px; font-weight: 500; color: #92400E;
  display: flex; align-items: center; gap: 6px;
}

/* Cabeçalho navy */
.panel-head {
  background: #10293F; color: #fff;
  padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px;
}

/* Mensagens */
.panel-msgs { flex: 1; overflow-y: auto; padding: 16px; background: #F8FAFC;
              display: flex; flex-direction: column; gap: 12px; }

.msg-in  .msg-bubble { background: #fff; border: 1px solid #E5E5E5; border-radius: 12px 12px 12px 2px; color: #333; }
.msg-out .msg-bubble { background: #10293F; color: #fff; border-radius: 12px 12px 2px 12px; }

/* Composer */
.panel-composer { border-top: 1px solid #E5E5E5; padding: 10px 12px; background: #fff; }
.pc-ai-btn:hover { background: #E8F9F9; border-color: #45E5E5; color: #10293F; }
.pc-input:focus { border-color: #45E5E5; background: #fff; }
.pc-send {
  width: 36px; height: 36px; border-radius: 8px;
  background: #45E5E5; color: #10293F;
  border: none; cursor: pointer;
}
.pc-send:hover { background: #2ecece; }
```

---

### 9. MODAL DE ATENDIMENTO COM ABAS

Estrutura: `kanban-strip` (260px esquerda, navy) + `main-panel` com sistema de abas.

```css
/* Modal overlay */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(16,41,63,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1050; padding: 24px;
}
.modal-shell {
  width: 100%; max-width: 1100px; height: 85vh;
  display: flex; border-radius: 12px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(16,41,63,0.3);
}

/* Kanban Strip */
.kanban-strip {
  width: 260px; flex-shrink: 0;
  background: #10293F; display: flex; flex-direction: column;
}
.ks-card.active { background: rgba(69,229,229,0.15); border-color: rgba(69,229,229,0.4); }

/* Tabs Bar */
.tabs-bar {
  display: flex; border-bottom: 1px solid #E5E5E5; padding: 0 16px; gap: 4px;
}
.tab.active { color: #10293F; border-bottom-color: #45E5E5; font-weight: 600; }
```

---

### 10. NAVEGADOR DE ESTÁGIO (Stage Navigator)

Mostra posição do ticket no fluxo kanban de forma visual.

```css
.sf-step.done .sf-dot    { background: #45E5E5; border-color: #45E5E5; color: #10293F; }
.sf-step.current .sf-dot { background: #10293F; border-color: #10293F; color: #fff; box-shadow: 0 0 0 4px rgba(16,41,63,0.15); }
.sf-step.done .sf-label    { color: #16A34A; }
.sf-step.current .sf-label { color: #10293F; font-weight: 600; }
.sf-line.done { background: #45E5E5; }
```

---

### 11. CARDS E MÉTRICAS (Dashboard)

```css
.metric-card {
  background: #fff; border: 1px solid #E5E5E5; border-radius: 8px;
  padding: 20px; box-shadow: 0 1px 3px rgba(16,41,63,0.06);
  transition: all 200ms;
}
.metric-card:hover { box-shadow: 0 4px 12px rgba(16,41,63,0.1); transform: translateY(-1px); }
.mc-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: #E8F9F9; color: #10293F;
}
.mc-number { font-size: 32px; font-weight: 700; color: #10293F; font-family: 'Poppins', sans-serif; }
.mc-delta.up   { color: #16A34A; }
.mc-delta.down { color: #DC2626; }
```

---

### 12. BADGES E STATUS

```css
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 9999px;
  font-size: 11px; font-weight: 600; line-height: 1.4;
  white-space: nowrap; border: 1px solid transparent;
}
.badge-info    { background: #E8F9F9; color: #10293F; border-color: rgba(69,229,229,0.4); }
.badge-success { background: #F0FDF4; color: #16A34A; border-color: rgba(22,163,74,0.3); }
.badge-warning { background: #FFFBEB; color: #92400E; border-color: rgba(255,184,0,0.5); }
.badge-error   { background: #FEF2F2; color: #DC2626; border-color: rgba(220,38,38,0.3); }
.badge-neutral { background: #F5F5F5; color: #444;    border-color: #E5E5E5; }
.badge-navy    { background: #10293F; color: #fff;    border-color: #10293F; }
.badge-cyan    { background: #45E5E5; color: #10293F; border-color: #45E5E5; }
.badge-yellow  { background: #FFB800; color: #10293F; border-color: #FFB800; }
```

---

### 13. FORMULÁRIOS E INPUTS

```css
.field-input {
  height: 38px; padding: 0 12px;
  border: 1px solid #CCCCCC; border-radius: 6px;
  font-size: 13px; font-family: inherit; color: #333; background: #fff;
  outline: none; transition: border-color 150ms, box-shadow 150ms;
}
.field-input:focus { border-color: #45E5E5; box-shadow: 0 0 0 3px rgba(69,229,229,0.15); }
.field-input:disabled { background: #F5F5F5; cursor: not-allowed; color: #888; }
.has-error .field-input { border-color: #DC2626; }
.has-error .field-input:focus { box-shadow: 0 0 0 3px rgba(220,38,38,0.15); }
.field-error { font-size: 11px; color: #DC2626; display: flex; align-items: center; gap: 4px; }
```

---

### 14. BOTÕES — 6 VARIANTES OFICIAIS

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 38px; padding: 0 16px; border-radius: 6px;
  font-size: 13px; font-weight: 600; font-family: inherit;
  border: 1px solid transparent; cursor: pointer;
  transition: all 150ms ease; white-space: nowrap;
}
.btn:focus-visible { outline: 2px solid #45E5E5; outline-offset: 2px; }
.btn:disabled      { opacity: 0.5; cursor: not-allowed; }

.btn-primary   { background: #45E5E5; color: #10293F; border-color: #45E5E5; }
.btn-primary:hover { background: #2ecece; border-color: #2ecece; }

.btn-secondary { background: #10293F; color: #fff; border-color: #10293F; }
.btn-secondary:hover { background: #1a3d5c; }

.btn-highlight { background: #FFB800; color: #10293F; border-color: #FFB800; }
.btn-highlight:hover { background: #e6a600; }

.btn-ghost  { background: transparent; color: #444; border-color: #E5E5E5; }
.btn-ghost:hover { background: #F5F5F5; border-color: #CCCCCC; color: #10293F; }

.btn-danger { background: #DC2626; color: #fff; border-color: #DC2626; }
.btn-danger:hover { background: #b91c1c; }

/* Tamanhos */
.btn-sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 4px; }
.btn-lg { height: 44px; padding: 0 22px; font-size: 15px; }
```

---

### 15. SETUP REACT — PADRÃO GMS

```jsx
// Objeto de cores — use sempre este padrão, nunca strings hardcoded espalhadas
const C = {
  navy:    '#10293F',
  navyH:  '#1a3d5c',
  cyan:    '#45E5E5',
  cyanH:  '#2ecece',
  yellow:  '#FFB800',
  white:   '#FFFFFF',
  bg:      '#F8FAFC',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#CCCCCC',
  gray500: '#666666',
  gray900: '#333333',
  error:   '#DC2626',
  success: '#16A34A',
};
```

---

### 16. TABELAS PADRÃO GMS

```css
.table-wrap { overflow-x: auto; border: 1px solid #E5E5E5; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; background: #fff; }
.table thead { background: #10293F; }
.table th {
  padding: 10px 14px; text-align: left;
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.8);
  text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
}
.table tbody tr { border-bottom: 1px solid #F0F0F0; transition: background 100ms; }
.table tbody tr:hover { background: #F8FAFC; }
.table td { padding: 10px 14px; font-size: 13px; color: #333; }
```

---

### 17. ACESSIBILIDADE — PADRÕES GMS

#### Contraste aprovado (WCAG AA)

| Texto | Fundo | Ratio | Status |
|---|---|---|---|
| `#10293F` | `#FFFFFF` | 14:1 | AAA |
| `#FFFFFF` | `#10293F` | 14:1 | AAA |
| `#10293F` | `#45E5E5` | 6.5:1 | AA |
| `#10293F` | `#FFB800` | 8:1 | AAA |
| `#333333` | `#FFFFFF` | 12.6:1 | AAA |

#### Padrões obrigatórios

```css
/* Focus visível em todos os interativos */
:focus-visible {
  outline: 2px solid #45E5E5;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Área mínima clicável */
button, [role="button"] { min-width: 44px; min-height: 44px; }
```

#### ARIA essencial

```html
<button aria-label="Fechar"><span class="icon">close</span></button>
<button aria-busy="true" aria-label="Salvando...">Salvando...</button>
<input aria-required="true" aria-describedby="hint-1">
<span id="hint-1">Campo obrigatório</span>
<div role="alert">[mensagem]</div>
```

---

### 18. MICRO-ANIMAÇÕES

```css
/* Animações base — respeitar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@keyframes fadeIn    { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideIn   { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes scaleIn   { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, #E8F9F9 25%, #d0f4f4 50%, #E8F9F9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### 19. CHECKLIST OBRIGATÓRIO ANTES DE ENTREGAR

#### Identidade Visual
- [ ] Cores restritas à paleta oficial (navy, cyan, yellow + neutros)?
- [ ] HEX exatos sem variações de tom?
- [ ] Texto sobre cyan usa navy `#10293F`?
- [ ] Texto sobre yellow usa navy `#10293F`?
- [ ] Sombras com `rgba(16,41,63,X)` (não preto)?
- [ ] Topbar presente e navy?

#### Componentes e Layout
- [ ] Topbar sticky 52px com logo GMS?
- [ ] Breadcrumb de localização presente?
- [ ] Cards com hover lift (translateY -1px)?
- [ ] Ícones Material Symbols Rounded?
- [ ] Abas com `border-bottom: 2px solid #45E5E5` na ativa?
- [ ] Prioridade dos cards com borda esquerda colorida?
- [ ] Colunas kanban com borda inferior colorida no cabeçalho?

#### Usabilidade e Acessibilidade
- [ ] Áreas clicáveis ≥ 44×44px?
- [ ] Labels em todos os campos?
- [ ] focus-visible com outline cyan?
- [ ] ARIA labels em botões de ícone?
- [ ] Contraste WCAG AA em todas as combinações?
- [ ] Estados hover/focus/active em todos os interativos?
- [ ] Feedback para ações (loading, sucesso, erro)?

---

### 20. FORMATO DE RESPOSTA

Ao criar uma tela, sempre:
1. Escolha HTML ou React (seção 3)
2. Use o `<head>` padrão se HTML (seção 4)
3. Inclua topbar (seção 5)
4. Aplique o layout correto para o tipo de tela (seção 6)
5. Execute o checklist (seção 19) antes de finalizar

Ao revisar uma interface:
```
## Revisão: [Nome da Tela]

### Conformidade Sismais
- ✅ [O que está correto]

### Violações (corrigir)
- ❌ [Problema] → [Correção com HEX exato]

### Acessibilidade
- ⚠️ [Problema] → [Solução]

### Prioridade
1. [Fix crítico]
2. [...]
```

**Regra absoluta:** Nunca invente variações de cor. Se o usuário pedir cor fora da paleta, questione e proponha a alternativa oficial mais próxima.

---

## Squad responsável (Hub EXPX)

Este projeto é operado pelo squad **helpdesk-dev-squad**, no hub EXPX:

- **Path:** `../agentes_sismais/squads/desenvolvimento/produto/helpdesk/helpdesk-dev-squad/`
- **Memória:** `_memory/memories.md` desse squad (leia antes de iniciar trabalho não trivial)
- **Squads relacionados:**
  - `../agentes_sismais/squads/suporte/atendimento/whatsapp/whatsapp-helpdesk/` (operação de atendimento)
  - `../agentes_sismais/squads/suporte/atendimento/knowledge-base/kb-curator/` (base de conhecimento)
- **Hub geral:** `../agentes_sismais/CLAUDE.md`

Para trabalho cross-squad, abra o Claude na raiz `../` (`Projects/`).
