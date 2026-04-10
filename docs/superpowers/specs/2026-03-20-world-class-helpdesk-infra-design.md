# Spec: World-Class AI-First Helpdesk — Fase 1: Infraestrutura Dev + Dashboard de Operações

**Data:** 2026-03-20
**Status:** Draft
**Autor:** Claude Opus 4.6 + Marcio S.
**Branch:** `claude/sismais-support-system-JCMCi`

---

## 1. Contexto e Motivação

O Sismais Helpdesk AI-First já possui um pipeline funcional (WhatsApp → Orquestrador → Agente IA → Resposta), 87 edge functions, 51 páginas React e 7 agentes IA configurados. Porém, para atingir nível world-class comparável a Intercom Fin 2, Sierra.ai, Zendesk AI e Google CCAI, precisamos:

1. **Reforçar a equipe de desenvolvimento** com agentes especializados (code review, testing, arquitetura)
2. **Criar um dashboard de operações** para supervisionar agentes de dev em tempo real
3. **Implementar fluxo de aprovação** para planos e código antes de execução/commit
4. **Preparar a base** para as fases seguintes (governança IA, customer data graph, novas specialties)

### Inspirações Arquiteturais

- **Anthropic:** Constitutional AI, confidence com explicação, extended thinking visível, tool use nativo, human-in-the-loop elegante
- **Google:** Customer Data Graph, A2A protocol (agent-to-agent), predictive engagement, analytics inline, no-code agent builder
- **Sierra.ai:** Multi-model orchestration, task specialization, automatic improvement
- **Intercom Fin 2:** Unified knowledge, behavioral customization, procedures & simulations
- **Forethought:** Agentic reasoning (Autoflows), multi-role agent system (Solve/Assist/Triage/Discover)
- **Ada.cx:** AI como team member com KPIs, feedback loops, coaching contínuo

---

## 2. Escopo da Fase 1

### 2.1 Instalar 14 agentes do agency-agents

Copiar de `msitarzewski/agency-agents` para `.claude/commands/`:

| # | Agente | Divisão | Arquivo fonte |
|---|---|---|---|
| 1 | Code Reviewer | Engineering | `engineering/engineering-code-reviewer.md` |
| 2 | Database Optimizer | Engineering | `engineering/engineering-database-optimizer.md` |
| 3 | Software Architect | Engineering | `engineering/engineering-software-architect.md` |
| 4 | API Tester | Testing | `testing/testing-api-tester.md` |
| 5 | Performance Benchmarker | Testing | `testing/testing-performance-benchmarker.md` |
| 6 | Workflow Optimizer | Testing | `testing/testing-workflow-optimizer.md` |
| 7 | Evidence Collector | Testing | `testing/testing-evidence-collector.md` |
| 8 | Reality Checker | Testing | `testing/testing-reality-checker.md` |
| 9 | Analytics Reporter | Support | `support/support-analytics-reporter.md` |
| 10 | Feedback Synthesizer | Product | `product/product-feedback-synthesizer.md` |
| 11 | Product Manager | Product | `product/product-manager.md` |
| 12 | Senior Project Manager | Project Mgmt | `project-management/project-manager-senior.md` |
| 13 | Agents Orchestrator | Specialized | `specialized/agents-orchestrator.md` |
| 14 | Workflow Architect | Specialized | `specialized/specialized-workflow-architect.md` |

**Total após instalação:** 26 commands (12 existentes + 14 novos)

### 2.2 Dashboard de Operações Dev

Projeto Vite+React separado em `tools/dev-dashboard/`, com SQLite local e WebSocket para realtime.

**Não faz parte do GMS** — é ferramenta exclusiva para supervisionar agentes de desenvolvimento (Claude Code).

### 2.3 Sistema de Aprovação

Fluxo onde agentes pedem aprovação antes de:
- **Executar planos** (specs, refatorações, features)
- **Fazer commit/push** (código novo, fixes)

O aprovador (Marcio) usa o dashboard para aprovar/rejeitar com feedback.

---

## 3. Arquitetura do Dashboard

### 3.1 Estrutura de Diretórios

```
tools/
└── dev-dashboard/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── server.ts              # Express + WebSocket + SQLite
    ├── db/
    │   ├── schema.sql         # DDL das tabelas
    │   └── seed.sql           # Seed com os 26 agentes
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── Dashboard.tsx      # Visão geral com cards por agente
    │   │   ├── TaskBoard.tsx      # Kanban 4 colunas
    │   │   ├── Approvals.tsx      # Fila de aprovação
    │   │   ├── AgentDetail.tsx    # Histórico e métricas de um agente
    │   │   └── Timeline.tsx       # Feed de atividades
    │   ├── components/
    │   │   ├── AgentCard.tsx
    │   │   ├── TaskCard.tsx
    │   │   ├── ApprovalCard.tsx
    │   │   ├── MetricCard.tsx
    │   │   ├── ActivityFeed.tsx
    │   │   ├── DiffViewer.tsx     # Syntax-highlighted diff
    │   │   └── MarkdownPreview.tsx # Renderizar planos
    │   └── lib/
    │       ├── ws.ts              # WebSocket client
    │       └── api.ts             # REST client
    ├── cli/
    │   └── report.ts             # CLI para agentes reportarem
    └── scripts/
        ├── start.sh              # Inicia server + vite
        └── create-shortcut.ps1   # Cria atalho no Desktop (Windows)
```

### 3.2 Stack Técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript | Mesmo stack do GMS, consistência |
| UI | TailwindCSS + paleta Sismais (dark mode) | Identidade visual, rápido de montar |
| Backend | Express + ws (WebSocket) | Mínimo, sem overhead |
| Banco | better-sqlite3 (WAL mode) | Zero config, persiste em arquivo, queries síncronas rápidas |
| CLI | TypeScript via `tsx` | Chamado manualmente pelos agentes |
| Runner | `tsx` (TypeScript execute) | Roda .ts diretamente sem build step |

### 3.2.1 Build e Execução

- **Server:** `npx tsx server.ts` — roda TypeScript diretamente, sem etapa de compilação
- **Frontend:** `vite dev` — dev server padrão na porta 5173, proxy para API na 3333
- **CLI:** `npx tsx cli/report.ts` — mesmo runner do server
- **Start combinado:** `scripts/start.sh` roda server + vite em paralelo via `concurrently`
- **CORS:** Não necessário — Vite proxy encaminha `/api/*` e `/ws` para o Express (porta 3333)

```typescript
// vite.config.ts — proxy config
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
      '/ws': { target: 'ws://localhost:3333', ws: true }
    }
  }
})
```

**Acesso:** O atalho no Desktop abre `http://localhost:5173` (Vite, que faz proxy para Express).

### 3.2.2 SQLite

- **Arquivo:** `tools/dev-dashboard/db/dev-ops.db` (criado automaticamente no primeiro start)
- **WAL mode:** Habilitado para permitir reads concorrentes enquanto CLI escreve
- **Localização no .gitignore:** `tools/dev-dashboard/db/*.db` — dados locais não vão pro repo
- **`activity_log.details`:** Armazena JSON stringificado. O CLI faz `JSON.stringify()` antes de inserir.

### 3.3 Schema SQLite

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  emoji TEXT,
  status TEXT DEFAULT 'idle' CHECK(status IN ('idle','working','blocked')),
  last_active_at DATETIME
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
  type TEXT CHECK(type IN ('plan','code','review','fix','research')),
  diff_preview TEXT,
  plan_content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER REFERENCES tasks(id),
  type TEXT NOT NULL CHECK(type IN ('plan','code')),
  content TEXT NOT NULL,
  summary TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para queries frequentes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
```

### 3.4 API REST

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/agents` | Lista agentes com status atual |
| `PATCH` | `/api/agents/:id` | Atualiza status do agente |
| `GET` | `/api/tasks` | Lista tasks (query: `?status=&agent_id=&type=`) |
| `POST` | `/api/tasks` | Cria task |
| `PATCH` | `/api/tasks/:id` | Atualiza task (status, descrição) |
| `GET` | `/api/approvals` | Lista aprovações (query: `?status=pending`) |
| `POST` | `/api/approvals` | Cria pedido de aprovação |
| `PATCH` | `/api/approvals/:id` | Aprova/rejeita (`{ status, feedback }`) |
| `GET` | `/api/activity` | Timeline (query: `?agent_id=&limit=50`) |
| `GET` | `/api/metrics` | Métricas agregadas |

### 3.5 API — Erros e Validação

- **Sucesso:** `200 OK` (GET/PATCH), `201 Created` (POST)
- **Validação:** `400 Bad Request` com `{ error: "mensagem" }` — ex: agent_id inexistente, campo obrigatório ausente
- **Não encontrado:** `404 Not Found` com `{ error: "Task not found" }`
- **Sem autenticação:** Não necessário — servidor é localhost-only, sem exposição externa

### 3.6 WebSocket Events

- **Sem autenticação:** Localhost-only, qualquer cliente pode conectar
- **Auto-reconnect:** O client WS deve reconectar automaticamente após desconexão (retry a cada 3s)

Toda mutação emite evento via WebSocket:

```typescript
type WSEvent =
  | { type: 'task:created'; data: Task }
  | { type: 'task:updated'; data: Task }
  | { type: 'approval:created'; data: Approval }
  | { type: 'approval:resolved'; data: Approval }
  | { type: 'agent:status_changed'; data: Agent }
  | { type: 'activity:new'; data: ActivityLog }
```

### 3.7 CLI para Agentes

```bash
# Reportar início de task
npx tsx tools/dev-dashboard/cli/report.ts task:start \
  --agent "code-reviewer" \
  --title "Revisar edge function reopen-conversation" \
  --type "review"

# Reportar conclusão
npx tsx tools/dev-dashboard/cli/report.ts task:done --id 42

# Pedir aprovação de plano
npx tsx tools/dev-dashboard/cli/report.ts approval:request \
  --agent "software-architect" \
  --type "plan" \
  --file "docs/superpowers/specs/plan.md" \
  --summary "Plano de refatoração do pipeline"

# Pedir aprovação de código
npx tsx tools/dev-dashboard/cli/report.ts approval:request \
  --agent "code-reviewer" \
  --type "code" \
  --diff "HEAD~1" \
  --summary "Fix no debounce do webhook"

# Log de atividade genérico
npx tsx tools/dev-dashboard/cli/report.ts log \
  --agent "database-optimizer" \
  --action "analysis_complete" \
  --details '{"slow_queries": 3, "suggestions": 5}'
```

---

## 4. Telas do Dashboard

### 4.1 Dashboard (Visão Geral)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  GMS DevOps Dashboard                    [localhost:3333] │
├──────────┬───────────────────────────────────────────────┤
│          │  MÉTRICAS GLOBAIS                             │
│          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  SIDEBAR │  │Tasks │ │Pend. │ │Done  │ │Taxa  │        │
│  Agentes │  │ 24   │ │ 3    │ │ 18   │ │ 92%  │        │
│          │  └──────┘ └──────┘ └──────┘ └──────┘        │
│ 👁 CodeRev│                                              │
│ 🗄 DBOpt  │  GRID DE AGENTES                            │
│ 🏛 Archit │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ 🔌 APITest│  │👁 CodeRev│ │🗄 DBOpt │ │🏛 Archit│      │
│ ⚡ PerfBnc│  │ working │ │  idle   │ │ working │      │
│ 🔄 WfOpt │  │ 5 tasks │ │ 2 tasks │ │ 3 tasks │      │
│ 📸 Evid  │  └─────────┘ └─────────┘ └─────────┘      │
│ 🔍 RealCk│                                              │
│ ...      │  ACTIVITY FEED                               │
│          │  14:32 👁 CodeRev iniciou "Review webhook"   │
│          │  14:28 🏛 Archit completou "Plan pipeline"   │
│          │  14:15 ⚡ PerfBnc pediu aprovação (código)   │
└──────────┴───────────────────────────────────────────────┘
```

### 4.2 Task Board (Kanban)

**Mapeamento status → coluna:**
- `todo` → A Fazer
- `in_progress` → Em Progresso
- `review` → Review (tasks que têm approval pendente aparecem com badge amarelo)
- `done` → Concluído

As aprovações (approve/reject) são gerenciadas na tabela `approvals`, não no status da task. Quando uma approval é rejeitada, a task volta para `in_progress`. Quando aprovada, a task pode avançar para `done`.

```
┌──────────┬────────────────────────────────────────────────┐
│  SIDEBAR │  [Filtro: Agente ▼] [Tipo ▼]                  │
│          ├──────────┬──────────┬──────────┬──────────────┤
│          │ A FAZER  │ EM PROG. │ REVIEW   │ CONCLUÍDO    │
│          │ cyan     │ navy     │ yellow   │ green        │
│          │          │          │          │              │
│          │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐    │
│          │ │Task 1│ │ │Task 3│ │ │Task 5│ │ │Task 7│    │
│          │ │CodeRv│ │ │Archit│ │ │DBOpt │ │ │APITst│    │
│          │ │review│ │ │plan  │ │ │code  │ │ │fix   │    │
│          │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘    │
└──────────┴──────────┴──────────┴──────────┴──────────────┘
```

### 4.3 Approvals (Fila de Aprovação)

```
┌──────────┬────────────────────────────────────────────────┐
│  SIDEBAR │  APROVAÇÕES PENDENTES (3)                      │
│          │                                                │
│          │  ┌────────────────────────────────────────────┐│
│          │  │ 🏛 Software Architect — PLANO              ││
│          │  │ "Refatoração do pipeline de mensagens"     ││
│          │  │                                            ││
│          │  │ ## Resumo                                  ││
│          │  │ Separar webhook em 3 etapas...             ││
│          │  │ [Ver plano completo ▼]                     ││
│          │  │                                            ││
│          │  │ [✅ Aprovar]  [❌ Rejeitar]                ││
│          │  │ Feedback: [________________]               ││
│          │  └────────────────────────────────────────────┘│
│          │                                                │
│          │  ┌────────────────────────────────────────────┐│
│          │  │ 👁 Code Reviewer — CÓDIGO                  ││
│          │  │ "Fix debounce no uazapi-webhook"           ││
│          │  │                                            ││
│          │  │ - src/hooks/useDebounce.ts                 ││
│          │  │ + const DEBOUNCE_MS = 2000; // era 5000   ││
│          │  │ [Ver diff completo ▼]                      ││
│          │  │                                            ││
│          │  │ [✅ Aprovar]  [❌ Rejeitar]                ││
│          │  └────────────────────────────────────────────┘│
└──────────┴────────────────────────────────────────────────┘
```

### 4.4 Estilo Visual

- **Tema:** Dark mode com paleta Sismais
- **Background:** `#0F1923` (navy mais escuro)
- **Cards:** `#1A2A3A` com borda `#2A3A4A`
- **Accent:** Cyan `#45E5E5` para elementos ativos
- **Texto:** `#E0E0E0` (primário), `#888` (secundário)
- **Status:** idle=gray, working=cyan, blocked=yellow
- **Prioridade:** low=green, normal=cyan, high=yellow, critical=red

---

## 5. Integração com Agentes de Desenvolvimento

A integração entre agentes Claude Code e o dashboard é **manual via CLI**. Não depende de hooks automáticos — cada agente chama o CLI explicitamente como parte do seu workflow.

### 5.1 Fluxo de Trabalho do Agente

```
1. Agente recebe tarefa
2. Chama: npx tsx cli/report.ts task:start --agent "X" --title "Y"
3. Executa o trabalho
4. Se precisa aprovação: npx tsx cli/report.ts approval:request --agent "X" --type plan|code
5. Aguarda aprovação no dashboard (polling /api/approvals/:id)
6. Ao concluir: npx tsx cli/report.ts task:done --id N
```

### 5.2 Git Hooks (opcional, `.git/hooks/post-commit`)

Para reportar commits automaticamente, um git hook `post-commit` pode ser adicionado:

```bash
#!/bin/bash
# .git/hooks/post-commit
LAST_MSG=$(git log -1 --pretty=%s)
npx tsx tools/dev-dashboard/cli/report.ts log \
  --agent "git" \
  --action "commit" \
  --details "{\"message\": \"$LAST_MSG\"}" 2>/dev/null || true
```

Isso é **opcional** — o agente pode reportar manualmente via CLI.

---

## 6. Atalho na Área de Trabalho

Script PowerShell que cria atalho `.lnk` no Desktop:

```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GMS DevOps.lnk")
$Shortcut.TargetPath = "http://localhost:5173"
$Shortcut.IconLocation = "shell32.dll,14"
$Shortcut.Description = "GMS Dev Dashboard"
$Shortcut.Save()
```

---

## 7. Roadmap Completo (Fases 1-3)

### Fase 1 — Infraestrutura Dev (esta spec)
- [ ] Instalar 14 agentes do agency-agents
- [ ] Dashboard de operações (Vite + SQLite + WebSocket)
- [ ] Sistema de aprovação (planos + código)
- [ ] CLI para agentes reportarem
- [ ] Integração manual via CLI + git hooks opcionais
- [ ] Atalho no Desktop

### Fase 2 — Governança IA + Dados (próxima spec)
- [ ] Criar skill `agent-governance` (Constitutional AI + audit trail)
- [ ] Criar skill `customer-data-graph` (timeline unificada GL+Admin+Helpdesk)
- [ ] Evoluir `crm-data-architect` → Customer Data Graph
- [ ] Evoluir `ai-safety-guardrails` → Constitutional guardrails
- [ ] Criar command `inline-analytics` (métricas contextuais no ticket)
- [ ] Implementar confidence com explicação no agent-executor
- [ ] Implementar thinking visível (tab "Raciocínio" no side panel)

### Fase 3 — Novas Specialties + Capacidades (spec futura)
- [ ] Novas specialties: guardian, proactive, discover, scheduler, collections, survey, quality_auditor
- [ ] Evoluir `ai-agent-orchestrator` → A2A protocol
- [ ] Criar skill `csat-nps-engine`
- [ ] Criar skill `agent-testing-specialist`
- [ ] Criar command `predictive-engagement`
- [ ] Criar command `agent-builder-wizard`
- [ ] Smart Summarization no pipeline
- [ ] Sentiment Analysis em tempo real
- [ ] Knowledge Gap Detection na KB
- [ ] SLA Breach Prediction

---

## 8. Critérios de Sucesso (Fase 1)

| Métrica | Target |
|---|---|
| Agentes instalados e funcionais | 26/26 |
| Dashboard acessível em localhost:5173 | Sim |
| Realtime funcionando (WebSocket) | < 500ms de delay |
| CLI reportando tasks manualmente | Agentes chamam CLI explicitamente |
| Fila de aprovação funcional | Aprovar/rejeitar com feedback |
| Atalho no Desktop criado | Abre dashboard no browser |

---

## 9. Dependências

| Pacote | Versão | Uso |
|---|---|---|
| `vite` | ^5.x | Build tool |
| `react` + `react-dom` | ^18.x | UI |
| `tailwindcss` | ^3.x | Estilo |
| `express` | ^4.x | API server |
| `ws` | ^8.x | WebSocket |
| `better-sqlite3` | ^11.x | Banco local |
| `react-diff-viewer-continued` | ^3.x | Diff syntax-highlighted |
| `react-markdown` | ^9.x | Renderizar planos |
| `lucide-react` | ^0.x | Ícones |
| `tsx` | ^4.x | Executa TypeScript diretamente (server + CLI) |
| `concurrently` | ^8.x | Roda server + vite em paralelo |

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Server precisa estar rodando | Script `npm run dev:dashboard` no package.json raiz |
| SQLite não suporta concorrência pesada | WAL mode habilitado, apenas 1 escritor (o CLI) |
| CLI pode não ser chamado pelo agente | Documentar no onboarding de cada agente que deve usar CLI |
| Agentes do agency-agents podem ter formato incompatível | Validar frontmatter YAML antes de copiar |
