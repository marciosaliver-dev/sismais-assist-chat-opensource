# Dev Dashboard + Agent Installation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install 14 development agents from agency-agents and build a realtime dev operations dashboard with approval system.

**Architecture:** Standalone Vite+React app in `tools/dev-dashboard/` with Express backend serving REST API + WebSocket. SQLite (better-sqlite3, WAL mode) for persistence. CLI script for agents to report status. Desktop shortcut for quick access.

**Tech Stack:** Vite 5, React 18, TypeScript, TailwindCSS, Express 4, ws 8, better-sqlite3 11, tsx 4, concurrently 8, react-diff-viewer-continued, react-markdown, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-20-world-class-helpdesk-infra-design.md`

---

## Task 1: Clone agency-agents and install 14 agent commands

**Files:**
- Create: `.claude/commands/code-reviewer.md`
- Create: `.claude/commands/database-optimizer.md`
- Create: `.claude/commands/software-architect.md`
- Create: `.claude/commands/api-tester.md`
- Create: `.claude/commands/performance-benchmarker.md`
- Create: `.claude/commands/workflow-optimizer.md`
- Create: `.claude/commands/evidence-collector.md`
- Create: `.claude/commands/reality-checker.md`
- Create: `.claude/commands/analytics-reporter.md`
- Create: `.claude/commands/feedback-synthesizer.md`
- Create: `.claude/commands/product-manager.md`
- Create: `.claude/commands/senior-project-manager.md`
- Create: `.claude/commands/agents-orchestrator.md`
- Create: `.claude/commands/workflow-architect.md`

- [ ] **Step 1: Clone agency-agents repo to temp directory**

```bash
TMPDIR=$(mktemp -d)
git clone --depth 1 https://github.com/msitarzewski/agency-agents.git "$TMPDIR/agency-agents"
```

- [ ] **Step 2: Copy the 14 selected agent files**

```bash
cp $TMPDIR/agency-agents/engineering/engineering-code-reviewer.md .claude/commands/code-reviewer.md
cp $TMPDIR/agency-agents/engineering/engineering-database-optimizer.md .claude/commands/database-optimizer.md
cp $TMPDIR/agency-agents/engineering/engineering-software-architect.md .claude/commands/software-architect.md
cp $TMPDIR/agency-agents/testing/testing-api-tester.md .claude/commands/api-tester.md
cp $TMPDIR/agency-agents/testing/testing-performance-benchmarker.md .claude/commands/performance-benchmarker.md
cp $TMPDIR/agency-agents/testing/testing-workflow-optimizer.md .claude/commands/workflow-optimizer.md
cp $TMPDIR/agency-agents/testing/testing-evidence-collector.md .claude/commands/evidence-collector.md
cp $TMPDIR/agency-agents/testing/testing-reality-checker.md .claude/commands/reality-checker.md
cp $TMPDIR/agency-agents/support/support-analytics-reporter.md .claude/commands/analytics-reporter.md
cp $TMPDIR/agency-agents/product/product-feedback-synthesizer.md .claude/commands/feedback-synthesizer.md
cp $TMPDIR/agency-agents/product/product-manager.md .claude/commands/product-manager.md
cp $TMPDIR/agency-agents/project-management/project-manager-senior.md .claude/commands/senior-project-manager.md
cp $TMPDIR/agency-agents/specialized/agents-orchestrator.md .claude/commands/agents-orchestrator.md
cp $TMPDIR/agency-agents/specialized/specialized-workflow-architect.md .claude/commands/workflow-architect.md
```

- [ ] **Step 3: Validate all 14 files have valid YAML frontmatter**

```bash
for f in .claude/commands/code-reviewer.md .claude/commands/database-optimizer.md .claude/commands/software-architect.md .claude/commands/api-tester.md .claude/commands/performance-benchmarker.md .claude/commands/workflow-optimizer.md .claude/commands/evidence-collector.md .claude/commands/reality-checker.md .claude/commands/analytics-reporter.md .claude/commands/feedback-synthesizer.md .claude/commands/product-manager.md .claude/commands/senior-project-manager.md .claude/commands/agents-orchestrator.md .claude/commands/workflow-architect.md; do
  echo "--- $f ---"
  head -3 "$f"
done
```

Expected: Each file starts with `---` (YAML frontmatter delimiter)

- [ ] **Step 4: Verify total command count is 26**

```bash
ls -1 .claude/commands/*.md | wc -l
```

Expected: `26`

- [ ] **Step 5: Clean up temp directory**

```bash
rm -rf "$TMPDIR"
```

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/code-reviewer.md .claude/commands/database-optimizer.md .claude/commands/software-architect.md .claude/commands/api-tester.md .claude/commands/performance-benchmarker.md .claude/commands/workflow-optimizer.md .claude/commands/evidence-collector.md .claude/commands/reality-checker.md .claude/commands/analytics-reporter.md .claude/commands/feedback-synthesizer.md .claude/commands/product-manager.md .claude/commands/senior-project-manager.md .claude/commands/agents-orchestrator.md .claude/commands/workflow-architect.md
git commit -m "feat: install 14 dev agents from agency-agents repository

Added: code-reviewer, database-optimizer, software-architect,
api-tester, performance-benchmarker, workflow-optimizer,
evidence-collector, reality-checker, analytics-reporter,
feedback-synthesizer, product-manager, senior-project-manager,
agents-orchestrator, workflow-architect

Source: github.com/msitarzewski/agency-agents"
```

---

## Task 2: Scaffold dev-dashboard project

**Files:**
- Create: `tools/dev-dashboard/package.json`
- Create: `tools/dev-dashboard/tsconfig.json`
- Create: `tools/dev-dashboard/vite.config.ts`
- Create: `tools/dev-dashboard/tailwind.config.js`
- Create: `tools/dev-dashboard/postcss.config.js`
- Create: `tools/dev-dashboard/index.html`
- Modify: `package.json` (root — add `dev:dashboard` script)
- Modify: `.gitignore` (add db file)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p tools/dev-dashboard/src tools/dev-dashboard/db tools/dev-dashboard/cli tools/dev-dashboard/scripts
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "gms-dev-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n server,vite -c blue,green \"npx tsx server.ts\" \"vite\"",
    "dev:server": "npx tsx server.ts",
    "dev:client": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "express": "^4.21.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/express": "^4.17.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/ws": "^8.5.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "lucide-react": "^0.460.0",
    "postcss": "^8.4.0",
    "react": "^18.3.0",
    "react-diff-viewer-continued": "^3.4.0",
    "react-dom": "^18.3.0",
    "react-markdown": "^9.0.0",
    "react-router-dom": "^6.28.0",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "server.ts", "cli"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
      '/ws': { target: 'ws://localhost:3333', ws: true }
    }
  }
})
```

- [ ] **Step 5: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#10293F', hover: '#1a3d5c', light: '#1e3f5a' },
        cyan: { DEFAULT: '#45E5E5', hover: '#2ecece', dark: '#28a8a8', light: '#E8F9F9' },
        yellow: { DEFAULT: '#FFB800', hover: '#e6a600' },
        surface: { DEFAULT: '#1A2A3A', light: '#243444', border: '#2A3A4A' },
        bg: '#0F1923',
      }
    }
  },
  plugins: []
}
```

- [ ] **Step 6: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 7: Create index.html**

```html
<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GMS DevOps Dashboard</title>
</head>
<body class="bg-bg text-gray-200 antialiased">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 8: Add dev:dashboard script to root package.json and .gitignore entry**

In root `package.json`, add to scripts:
```json
"dev:dashboard": "cd tools/dev-dashboard && npm run dev"
```

In root `.gitignore`, add:
```
tools/dev-dashboard/db/*.db
tools/dev-dashboard/db/*.db-wal
tools/dev-dashboard/db/*.db-shm
tools/dev-dashboard/node_modules/
```

- [ ] **Step 9: Install dependencies**

```bash
cd tools/dev-dashboard && npm install
```

- [ ] **Step 10: Commit**

```bash
git add tools/dev-dashboard/package.json tools/dev-dashboard/tsconfig.json tools/dev-dashboard/vite.config.ts tools/dev-dashboard/tailwind.config.js tools/dev-dashboard/postcss.config.js tools/dev-dashboard/index.html package.json .gitignore
git commit -m "feat: scaffold dev-dashboard project (Vite + React + Express + SQLite)"
```

---

## Task 3: SQLite schema and server

**Files:**
- Create: `tools/dev-dashboard/db/schema.sql`
- Create: `tools/dev-dashboard/db/seed.sql`
- Create: `tools/dev-dashboard/server.ts`

- [ ] **Step 1: Create schema.sql**

```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  emoji TEXT,
  status TEXT DEFAULT 'idle' CHECK(status IN ('idle','working','blocked')),
  last_active_at DATETIME
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE TABLE IF NOT EXISTS approvals (
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

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
```

- [ ] **Step 2: Create seed.sql with all 26 agents**

```sql
INSERT OR IGNORE INTO agents (id, name, division, emoji) VALUES
-- Existing 12 commands
('ai-agent-orchestrator', 'AI Agent Orchestrator', 'ai', '🤖'),
('ai-safety-guardrails', 'AI Safety Guardrails', 'ai', '🛡️'),
('ai-training-feedback-loop', 'AI Training Feedback', 'ai', '🔄'),
('automation-workflow-engine', 'Automation Workflow', 'automation', '⚙️'),
('conversation-flow-architect', 'Conversation Flow', 'ai', '💬'),
('crm-data-architect', 'CRM Data Architect', 'data', '🗄️'),
('otimizar-consumo', 'Otimizar Consumo', 'ops', '💰'),
('prompt-engineering-specialist', 'Prompt Engineering', 'ai', '✍️'),
('rag-knowledge-engineer', 'RAG Knowledge', 'ai', '📚'),
('sla-analytics-specialist', 'SLA Analytics', 'analytics', '📊'),
('supabase-realtime-engine', 'Supabase Realtime', 'infra', '⚡'),
('uazapi-specialist', 'UAZAPI Specialist', 'integration', '📱'),
-- New 14 from agency-agents
('code-reviewer', 'Code Reviewer', 'engineering', '👁️'),
('database-optimizer', 'Database Optimizer', 'engineering', '🗄️'),
('software-architect', 'Software Architect', 'engineering', '🏛️'),
('api-tester', 'API Tester', 'testing', '🔌'),
('performance-benchmarker', 'Performance Benchmarker', 'testing', '⚡'),
('workflow-optimizer', 'Workflow Optimizer', 'testing', '🔄'),
('evidence-collector', 'Evidence Collector', 'testing', '📸'),
('reality-checker', 'Reality Checker', 'testing', '🔍'),
('analytics-reporter', 'Analytics Reporter', 'support', '📊'),
('feedback-synthesizer', 'Feedback Synthesizer', 'product', '💬'),
('product-manager', 'Product Manager', 'product', '🧭'),
('senior-project-manager', 'Senior Project Manager', 'project', '👔'),
('agents-orchestrator', 'Agents Orchestrator', 'specialized', '🎭'),
('workflow-architect', 'Workflow Architect', 'specialized', '🗺️');
```

- [ ] **Step 3: Create server.ts**

```typescript
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import Database from 'better-sqlite3'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'db', 'dev-ops.db')

// Init database
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(readFileSync(join(__dirname, 'db', 'schema.sql'), 'utf-8'))
db.exec(readFileSync(join(__dirname, 'db', 'seed.sql'), 'utf-8'))

// Express app
const app = express()
app.use(express.json())

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Broadcast to all connected clients
function broadcast(event: { type: string; data: unknown }) {
  const msg = JSON.stringify(event)
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  })
}

// --- AGENTS ---
app.get('/api/agents', (_req, res) => {
  res.json(db.prepare('SELECT * FROM agents ORDER BY division, name').all())
})

app.patch('/api/agents/:id', (req, res) => {
  const { status } = req.body
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  db.prepare('UPDATE agents SET status = ?, last_active_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, req.params.id)
  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id)
  broadcast({ type: 'agent:status_changed', data: updated })
  res.json(updated)
})

// --- TASKS ---
app.get('/api/tasks', (req, res) => {
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params: unknown[] = []
  if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status) }
  if (req.query.agent_id) { sql += ' AND agent_id = ?'; params.push(req.query.agent_id) }
  if (req.query.type) { sql += ' AND type = ?'; params.push(req.query.type) }
  sql += ' ORDER BY created_at DESC'
  res.json(db.prepare(sql).all(...params))
})

app.post('/api/tasks', (req, res) => {
  const { agent_id, title, description, priority, type, status } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })
  if (agent_id) {
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent_id)
    if (!agent) return res.status(400).json({ error: `Agent '${agent_id}' not found` })
  }
  const initialStatus = status || 'todo'
  const result = db.prepare(
    'INSERT INTO tasks (agent_id, title, description, priority, type, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(agent_id || null, title, description || null, priority || 'normal', type || null, initialStatus)
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
  // Update agent status
  if (agent_id) {
    db.prepare('UPDATE agents SET status = ?, last_active_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('working', agent_id)
  }
  // Log activity
  db.prepare('INSERT INTO activity_log (agent_id, action, details) VALUES (?, ?, ?)')
    .run(agent_id || null, 'task_created', JSON.stringify({ task_id: result.lastInsertRowid, title }))
  broadcast({ type: 'task:created', data: task })
  res.status(201).json(task)
})

app.patch('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const { status, description, diff_preview, plan_content } = req.body
  const updates: string[] = []
  const params: unknown[] = []
  if (status) { updates.push('status = ?'); params.push(status) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (diff_preview !== undefined) { updates.push('diff_preview = ?'); params.push(diff_preview) }
  if (plan_content !== undefined) { updates.push('plan_content = ?'); params.push(plan_content) }
  updates.push('updated_at = CURRENT_TIMESTAMP')
  params.push(req.params.id)
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  // If done, set agent idle
  if (status === 'done' && (task as any).agent_id) {
    db.prepare('UPDATE agents SET status = ?, last_active_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('idle', (task as any).agent_id)
  }
  // Log
  db.prepare('INSERT INTO activity_log (agent_id, action, details) VALUES (?, ?, ?)')
    .run((task as any).agent_id, `task_${status || 'updated'}`, JSON.stringify({ task_id: req.params.id }))
  broadcast({ type: 'task:updated', data: updated })
  res.json(updated)
})

// --- APPROVALS ---
app.get('/api/approvals', (req, res) => {
  let sql = 'SELECT a.*, t.title as task_title, t.agent_id FROM approvals a LEFT JOIN tasks t ON a.task_id = t.id WHERE 1=1'
  const params: unknown[] = []
  if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status) }
  sql += ' ORDER BY a.created_at DESC'
  res.json(db.prepare(sql).all(...params))
})

app.post('/api/approvals', (req, res) => {
  const { task_id, type, content, summary } = req.body
  if (!type || !content) return res.status(400).json({ error: 'type and content are required' })
  if (task_id) {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(task_id)
    if (!task) return res.status(400).json({ error: 'Task not found' })
    // Move task to review
    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('review', task_id)
  }
  const result = db.prepare(
    'INSERT INTO approvals (task_id, type, content, summary) VALUES (?, ?, ?, ?)'
  ).run(task_id || null, type, content, summary || null)
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(result.lastInsertRowid)
  // Log
  db.prepare('INSERT INTO activity_log (agent_id, action, details) VALUES (?, ?, ?)')
    .run(null, 'approval_requested', JSON.stringify({ approval_id: result.lastInsertRowid, type }))
  broadcast({ type: 'approval:created', data: approval })
  res.status(201).json(approval)
})

app.patch('/api/approvals/:id', (req, res) => {
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(req.params.id) as any
  if (!approval) return res.status(404).json({ error: 'Approval not found' })
  const { status, feedback } = req.body
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' })
  }
  if (status === 'rejected' && !feedback) {
    return res.status(400).json({ error: 'feedback is required when rejecting' })
  }
  db.prepare('UPDATE approvals SET status = ?, feedback = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, feedback || null, req.params.id)
  // Update linked task
  if (approval.task_id) {
    const newTaskStatus = status === 'approved' ? 'done' : 'in_progress'
    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newTaskStatus, approval.task_id)
  }
  const updated = db.prepare('SELECT * FROM approvals WHERE id = ?').get(req.params.id)
  // Log
  db.prepare('INSERT INTO activity_log (agent_id, action, details) VALUES (?, ?, ?)')
    .run(null, `approval_${status}`, JSON.stringify({ approval_id: req.params.id, feedback }))
  broadcast({ type: 'approval:resolved', data: updated })
  res.json(updated)
})

// --- ACTIVITY ---
app.post('/api/activity', (req, res) => {
  const { agent_id, action, details } = req.body
  if (!action) return res.status(400).json({ error: 'action is required' })
  const result = db.prepare('INSERT INTO activity_log (agent_id, action, details) VALUES (?, ?, ?)')
    .run(agent_id || null, action, details ? JSON.stringify(details) : null)
  const entry = db.prepare('SELECT l.*, a.name as agent_name, a.emoji as agent_emoji FROM activity_log l LEFT JOIN agents a ON l.agent_id = a.id WHERE l.id = ?')
    .get(result.lastInsertRowid)
  broadcast({ type: 'activity:new', data: entry })
  res.status(201).json(entry)
})

app.get('/api/activity', (req, res) => {
  let sql = 'SELECT l.*, a.name as agent_name, a.emoji as agent_emoji FROM activity_log l LEFT JOIN agents a ON l.agent_id = a.id WHERE 1=1'
  const params: unknown[] = []
  if (req.query.agent_id) { sql += ' AND l.agent_id = ?'; params.push(req.query.agent_id) }
  const limit = parseInt(req.query.limit as string) || 50
  sql += ' ORDER BY l.created_at DESC LIMIT ?'
  params.push(limit)
  res.json(db.prepare(sql).all(...params))
})

// --- METRICS ---
app.get('/api/metrics', (_req, res) => {
  const total = (db.prepare('SELECT COUNT(*) as c FROM tasks').get() as any).c
  const pending = (db.prepare("SELECT COUNT(*) as c FROM approvals WHERE status = 'pending'").get() as any).c
  const doneToday = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'done' AND date(updated_at) = date('now')").get() as any).c
  const totalDone = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'done'").get() as any).c
  const approvalRate = total > 0 ? Math.round((totalDone / total) * 100) : 0
  res.json({ total, pending, doneToday, totalDone, approvalRate })
})

// Start
const PORT = 3333
server.listen(PORT, () => {
  console.log(`🚀 GMS DevOps Dashboard API running on http://localhost:${PORT}`)
  console.log(`📊 WebSocket on ws://localhost:${PORT}/ws`)
})
```

- [ ] **Step 4: Verify server starts without errors**

```bash
cd tools/dev-dashboard && npx tsx server.ts &
sleep 2
curl -s http://localhost:3333/api/agents | head -c 200
kill %1
```

Expected: JSON array of 26 agents

- [ ] **Step 5: Commit**

```bash
git add tools/dev-dashboard/db/schema.sql tools/dev-dashboard/db/seed.sql tools/dev-dashboard/server.ts
git commit -m "feat: add SQLite schema, seed data, and Express+WS server

- Schema with agents, tasks, approvals, activity_log tables
- Seed with 26 agents (12 existing + 14 new)
- REST API for CRUD operations
- WebSocket broadcasting for realtime updates
- WAL mode for concurrent read/write"
```

---

## Task 4: CLI report tool

**Files:**
- Create: `tools/dev-dashboard/cli/report.ts`

- [ ] **Step 1: Create report.ts**

```typescript
#!/usr/bin/env npx tsx
import { argv, exit } from 'process'

const API = 'http://localhost:3333/api'

async function api(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    console.error(`❌ ${err.error || res.statusText}`)
    exit(1)
  }
  return res.json()
}

const [,, command, ...args] = argv

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 ? args[idx + 1] : undefined
}

async function main() {
  switch (command) {
    case 'task:start': {
      const agent = getFlag('agent')
      const title = getFlag('title')
      const type = getFlag('type')
      if (!title) { console.error('--title required'); exit(1) }
      const task = await api('/tasks', 'POST', { agent_id: agent, title, type, status: 'in_progress' })
      // Also update agent status
      if (agent) await api(`/agents/${agent}`, 'PATCH', { status: 'working' })
      console.log(`✅ Task #${task.id} started: ${title}`)
      break
    }
    case 'task:done': {
      const id = getFlag('id')
      if (!id) { console.error('--id required'); exit(1) }
      await api(`/tasks/${id}`, 'PATCH', { status: 'done' })
      console.log(`✅ Task #${id} done`)
      break
    }
    case 'approval:request': {
      const agent = getFlag('agent')
      const type = getFlag('type')
      const summary = getFlag('summary')
      const file = getFlag('file')
      const diff = getFlag('diff')
      if (!type) { console.error('--type required (plan|code)'); exit(1) }

      let content = ''
      if (file) {
        const { readFileSync } = await import('fs')
        content = readFileSync(file, 'utf-8')
      } else if (diff) {
        const { execSync } = await import('child_process')
        content = execSync(`git diff ${diff}`, { encoding: 'utf-8' })
      } else {
        console.error('--file or --diff required'); exit(1)
      }

      // Create task first if agent provided
      let taskId: number | undefined
      if (agent) {
        const task = await api('/tasks', 'POST', {
          agent_id: agent, title: summary || `${type} approval`, type
        })
        taskId = task.id
      }

      const approval = await api('/approvals', 'POST', {
        task_id: taskId, type, content, summary
      })
      console.log(`🔔 Approval #${approval.id} requested (${type})`)
      break
    }
    case 'log': {
      const agent = getFlag('agent')
      const action = getFlag('action')
      const details = getFlag('details')
      if (!action) { console.error('--action required'); exit(1) }
      await api('/activity', 'POST', {
        agent_id: agent, action, details: details ? JSON.parse(details) : null
      })
      console.log(`📝 Logged: ${action}`)
      break
    }
    default:
      console.log(`Usage: npx tsx report.ts <command> [flags]

Commands:
  task:start     --agent <id> --title <text> [--type plan|code|review|fix]
  task:done      --id <number>
  approval:request --agent <id> --type plan|code --summary <text> (--file <path> | --diff <ref>)
  log            --agent <id> --action <text> [--details <json>]`)
  }
}

main().catch(err => { console.error(err); exit(1) })
```

- [ ] **Step 2: Test CLI help output**

```bash
cd tools/dev-dashboard && npx tsx cli/report.ts
```

Expected: Usage help text displayed

- [ ] **Step 3: Test CLI with running server (integration test)**

```bash
cd tools/dev-dashboard && npx tsx server.ts &
sleep 2
npx tsx cli/report.ts task:start --agent "code-reviewer" --title "Test task from CLI" --type "review"
npx tsx cli/report.ts task:done --id 1
curl -s http://localhost:3333/api/tasks | python3 -m json.tool | head -20
kill %1
```

Expected: Task created and completed, visible in API response

- [ ] **Step 4: Commit**

```bash
git add tools/dev-dashboard/cli/report.ts
git commit -m "feat: add CLI report tool for agents to report status

Commands: task:start, task:done, approval:request, log
Reads files and git diffs for approval content"
```

---

## Task 5: React app — entry point, layout, and routing

**Files:**
- Create: `tools/dev-dashboard/src/main.tsx`
- Create: `tools/dev-dashboard/src/index.css`
- Create: `tools/dev-dashboard/src/App.tsx`
- Create: `tools/dev-dashboard/src/lib/api.ts`
- Create: `tools/dev-dashboard/src/lib/ws.ts`
- Create: `tools/dev-dashboard/src/components/Sidebar.tsx`

- [ ] **Step 1: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0F1923; }
::-webkit-scrollbar-thumb { background: #2A3A4A; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #45E5E5; }
```

- [ ] **Step 2: Create src/lib/api.ts**

```typescript
const BASE = '/api'

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}
```

- [ ] **Step 3: Create src/lib/ws.ts**

```typescript
type Listener = (event: { type: string; data: unknown }) => void

let socket: WebSocket | null = null
const listeners: Set<Listener> = new Set()

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${location.host}/ws`)

  socket.onmessage = (e) => {
    const event = JSON.parse(e.data)
    listeners.forEach(fn => fn(event))
  }

  socket.onclose = () => {
    setTimeout(connect, 3000)
  }

  socket.onerror = () => socket?.close()
}

export function subscribe(fn: Listener) {
  if (!socket) connect()
  listeners.add(fn)
  return () => listeners.delete(fn)
}
```

- [ ] **Step 4: Create src/components/Sidebar.tsx**

```tsx
import { LayoutDashboard, KanbanSquare, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: KanbanSquare, label: 'Task Board' },
  { to: '/approvals', icon: CheckCircle, label: 'Approvals' },
  { to: '/timeline', icon: Clock, label: 'Timeline' },
]

export function Sidebar() {
  return (
    <aside className="w-56 bg-navy flex flex-col border-r border-surface-border shrink-0">
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="bg-cyan text-navy text-xs font-bold px-1.5 py-0.5 rounded">GMS</span>
          <span className="text-sm font-medium text-white/90">DevOps</span>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-cyan/10 text-cyan font-medium'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-surface-border text-xs text-white/30">
        26 agents registered
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Create src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'

function Placeholder({ name }: { name: string }) {
  return <div className="flex-1 flex items-center justify-center text-white/30 text-lg">{name} — coming next</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Placeholder name="Dashboard" />} />
            <Route path="/tasks" element={<Placeholder name="Task Board" />} />
            <Route path="/approvals" element={<Placeholder name="Approvals" />} />
            <Route path="/timeline" element={<Placeholder name="Timeline" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Create src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 7: Verify app starts**

```bash
cd tools/dev-dashboard && npm run dev &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
```

Expected: HTML with `<div id="root">`

- [ ] **Step 8: Commit**

```bash
git add tools/dev-dashboard/src/
git commit -m "feat: add React app with routing, sidebar, API client, and WebSocket

Dark mode layout with Sismais palette, 4 routes (dashboard, tasks, approvals, timeline)"
```

---

## Task 6: Dashboard page — metrics + agent grid + activity feed

**Files:**
- Create: `tools/dev-dashboard/src/components/MetricCard.tsx`
- Create: `tools/dev-dashboard/src/components/AgentCard.tsx`
- Create: `tools/dev-dashboard/src/components/ActivityFeed.tsx`
- Create: `tools/dev-dashboard/src/pages/Dashboard.tsx`
- Modify: `tools/dev-dashboard/src/App.tsx`

- [ ] **Step 1: Create MetricCard.tsx**

```tsx
interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
}

export function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-white/50">{label}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AgentCard.tsx**

```tsx
interface Agent {
  id: string
  name: string
  division: string
  emoji: string
  status: 'idle' | 'working' | 'blocked'
}

const statusColors = {
  idle: 'bg-white/10 text-white/40',
  working: 'bg-cyan/10 text-cyan border-cyan/30',
  blocked: 'bg-yellow/10 text-yellow border-yellow/30'
}

const statusLabels = { idle: 'Idle', working: 'Ativo', blocked: 'Bloqueado' }

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`rounded-lg border p-3 transition-all ${statusColors[agent.status]} border-surface-border`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{agent.emoji}</span>
        <span className="text-sm font-medium text-white truncate">{agent.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{agent.division}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColors[agent.status]}`}>
          {statusLabels[agent.status]}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ActivityFeed.tsx**

```tsx
interface Activity {
  id: number
  agent_name: string | null
  agent_emoji: string | null
  action: string
  details: string | null
  created_at: string
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const actionLabels: Record<string, string> = {
  task_created: 'criou task',
  task_in_progress: 'iniciou',
  task_done: 'concluiu',
  task_review: 'enviou para review',
  approval_requested: 'pediu aprovação',
  approval_approved: 'aprovado',
  approval_rejected: 'rejeitado',
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="space-y-1">
      {activities.map(a => (
        <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 text-sm">
          <span className="text-xs text-white/30 w-8 shrink-0">{timeAgo(a.created_at)}</span>
          <span>{a.agent_emoji || '📋'}</span>
          <span className="text-white/70 truncate">
            {a.agent_name || 'Sistema'} {actionLabels[a.action] || a.action}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create pages/Dashboard.tsx**

```tsx
import { useEffect, useState } from 'react'
import { ListTodo, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { MetricCard } from '../components/MetricCard'
import { AgentCard } from '../components/AgentCard'
import { ActivityFeed } from '../components/ActivityFeed'

interface Metrics { total: number; pending: number; doneToday: number; approvalRate: number }

export function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, pending: 0, doneToday: 0, approvalRate: 0 })
  const [agents, setAgents] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])

  const reload = () => {
    api<Metrics>('/metrics').then(setMetrics)
    api<any[]>('/agents').then(setAgents)
    api<any[]>('/activity?limit=20').then(setActivities)
  }

  useEffect(() => {
    reload()
    return subscribe(() => reload())
  }, [])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Tasks" value={metrics.total} icon={<ListTodo size={20} />} />
        <MetricCard label="Pendentes Aprovação" value={metrics.pending} icon={<Clock size={20} />} />
        <MetricCard label="Concluídas Hoje" value={metrics.doneToday} icon={<CheckCircle2 size={20} />} />
        <MetricCard label="Taxa Conclusão" value={`${metrics.approvalRate}%`} icon={<TrendingUp size={20} />} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="text-sm font-medium text-white/60 mb-3">Agentes ({agents.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {agents.map(a => <AgentCard key={a.id} agent={a} />)}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-white/60 mb-3">Atividade Recente</h2>
          <div className="bg-surface rounded-xl border border-surface-border p-3 max-h-96 overflow-y-auto">
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update App.tsx to use Dashboard page**

Replace the Dashboard placeholder route:
```tsx
import { Dashboard } from './pages/Dashboard'
// ...
<Route path="/" element={<Dashboard />} />
```

- [ ] **Step 6: Verify dashboard renders with agent data**

Start server + vite, open `http://localhost:5173`, confirm:
- 4 metric cards visible
- 26 agent cards in grid
- Activity feed (may be empty initially)

- [ ] **Step 7: Commit**

```bash
git add tools/dev-dashboard/src/
git commit -m "feat: add Dashboard page with metrics, agent grid, and activity feed

Realtime updates via WebSocket, dark mode with Sismais palette"
```

---

## Task 7: Task Board page (Kanban)

**Files:**
- Create: `tools/dev-dashboard/src/components/TaskCard.tsx`
- Create: `tools/dev-dashboard/src/pages/TaskBoard.tsx`
- Modify: `tools/dev-dashboard/src/App.tsx`

- [ ] **Step 1: Create TaskCard.tsx**

```tsx
interface Task {
  id: number
  agent_id: string | null
  title: string
  status: string
  priority: string
  type: string | null
  created_at: string
}

const priorityBorder = {
  low: 'border-l-green-500',
  normal: 'border-l-cyan',
  high: 'border-l-yellow',
  critical: 'border-l-red-500'
}

const typeLabel: Record<string, string> = {
  plan: '📋 Plano', code: '💻 Código', review: '👁 Review', fix: '🔧 Fix', research: '🔍 Pesquisa'
}

export function TaskCard({ task }: { task: Task }) {
  return (
    <div className={`bg-surface rounded-lg border border-surface-border p-3 border-l-2 ${priorityBorder[task.priority as keyof typeof priorityBorder] || 'border-l-cyan'} cursor-pointer hover:bg-surface-light transition-colors`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/30 font-mono">#{task.id}</span>
        {task.type && <span className="text-xs text-white/50">{typeLabel[task.type] || task.type}</span>}
      </div>
      <div className="text-sm font-medium text-white mb-2 leading-snug">{task.title}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{task.agent_id || '—'}</span>
        <span className="text-xs text-white/30">
          {new Date(task.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create pages/TaskBoard.tsx**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { TaskCard } from '../components/TaskCard'

const columns = [
  { key: 'todo', label: 'A Fazer', color: 'border-t-cyan' },
  { key: 'in_progress', label: 'Em Progresso', color: 'border-t-navy-hover' },
  { key: 'review', label: 'Review', color: 'border-t-yellow' },
  { key: 'done', label: 'Concluído', color: 'border-t-green-500' },
]

export function TaskBoard() {
  const [tasks, setTasks] = useState<any[]>([])
  const [filterAgent, setFilterAgent] = useState('')
  const [agents, setAgents] = useState<any[]>([])

  const reload = () => {
    const params = filterAgent ? `?agent_id=${filterAgent}` : ''
    api<any[]>(`/tasks${params}`).then(setTasks)
  }

  useEffect(() => {
    reload()
    api<any[]>('/agents').then(setAgents)
    return subscribe(() => reload())
  }, [filterAgent])

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-white">Task Board</h1>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white/80"
        >
          <option value="">Todos os agentes</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key)
          return (
            <div key={col.key} className={`flex flex-col rounded-xl bg-bg border border-surface-border border-t-2 ${col.color}`}>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">{col.label}</span>
                <span className="text-xs text-white/30 bg-white/5 px-1.5 rounded">{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colTasks.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx**

```tsx
import { TaskBoard } from './pages/TaskBoard'
// ...
<Route path="/tasks" element={<TaskBoard />} />
```

- [ ] **Step 4: Verify kanban renders**

Open `http://localhost:5173/tasks`, confirm 4 columns visible.

- [ ] **Step 5: Commit**

```bash
git add tools/dev-dashboard/src/
git commit -m "feat: add Task Board page with 4-column kanban layout

Columns: A Fazer, Em Progresso, Review, Concluido
Filter by agent, realtime updates via WebSocket"
```

---

## Task 8: Approvals page

**Files:**
- Create: `tools/dev-dashboard/src/components/ApprovalCard.tsx`
- Create: `tools/dev-dashboard/src/pages/Approvals.tsx`
- Modify: `tools/dev-dashboard/src/App.tsx`

- [ ] **Step 1: Create ApprovalCard.tsx**

```tsx
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib/api'

interface Approval {
  id: number
  task_id: number | null
  task_title: string | null
  agent_id: string | null
  type: 'plan' | 'code'
  content: string
  summary: string | null
  status: 'pending' | 'approved' | 'rejected'
  feedback: string | null
  created_at: string
}

export function ApprovalCard({ approval, onResolved }: { approval: Approval; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  const resolve = async (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !feedback.trim()) {
      alert('Feedback obrigatório ao rejeitar')
      return
    }
    setLoading(true)
    await api(`/approvals/${approval.id}`, 'PATCH', { status, feedback: feedback || null })
    setLoading(false)
    onResolved()
  }

  const isPending = approval.status === 'pending'

  return (
    <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              approval.type === 'plan' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
            }`}>
              {approval.type === 'plan' ? '📋 Plano' : '💻 Código'}
            </span>
            {approval.agent_id && <span className="text-xs text-white/40">{approval.agent_id}</span>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            approval.status === 'pending' ? 'bg-yellow/20 text-yellow' :
            approval.status === 'approved' ? 'bg-green-500/20 text-green-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {approval.status === 'pending' ? 'Pendente' : approval.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
          </span>
        </div>

        {approval.summary && (
          <p className="text-sm text-white/80 mb-2">{approval.summary}</p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-cyan hover:text-cyan-hover transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Ocultar conteúdo' : 'Ver conteúdo completo'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-surface-border p-4 max-h-96 overflow-y-auto bg-bg">
          {approval.type === 'plan' ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{approval.content}</ReactMarkdown>
            </div>
          ) : (
            <ReactDiffViewer
              oldValue=""
              newValue={approval.content}
              splitView={false}
              useDarkTheme={true}
              compareMethod={DiffMethod.LINES}
              styles={{
                contentText: { fontSize: '12px', fontFamily: 'monospace' }
              }}
            />
          )}
        </div>
      )}

      {isPending && (
        <div className="border-t border-surface-border p-4 space-y-3">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Feedback (obrigatório para rejeitar)"
            className="w-full bg-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => resolve('approved')}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={16} /> Aprovar
            </button>
            <button
              onClick={() => resolve('rejected')}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle size={16} /> Rejeitar
            </button>
          </div>
        </div>
      )}

      {approval.feedback && !isPending && (
        <div className="border-t border-surface-border p-3 bg-bg">
          <span className="text-xs text-white/40">Feedback:</span>
          <p className="text-sm text-white/70 mt-1">{approval.feedback}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create pages/Approvals.tsx**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { ApprovalCard } from '../components/ApprovalCard'

export function Approvals() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const reload = () => {
    const params = filter === 'pending' ? '?status=pending' : ''
    api<any[]>(`/approvals${params}`).then(setApprovals)
  }

  useEffect(() => {
    reload()
    return subscribe(() => reload())
  }, [filter])

  const pendingCount = approvals.filter(a => a.status === 'pending').length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">
          Aprovações
          {pendingCount > 0 && (
            <span className="ml-2 text-sm bg-yellow/20 text-yellow px-2 py-0.5 rounded-full">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
          )}
        </h1>
        <div className="flex gap-1 bg-surface rounded-lg p-0.5">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded text-sm transition-colors ${filter === 'pending' ? 'bg-cyan/10 text-cyan' : 'text-white/50'}`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${filter === 'all' ? 'bg-cyan/10 text-cyan' : 'text-white/50'}`}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <div className="text-center text-white/30 py-12">Nenhuma aprovação {filter === 'pending' ? 'pendente' : ''}</div>
        ) : (
          approvals.map(a => <ApprovalCard key={a.id} approval={a} onResolved={reload} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx**

```tsx
import { Approvals } from './pages/Approvals'
// ...
<Route path="/approvals" element={<Approvals />} />
```

- [ ] **Step 4: Verify approvals page**

Open `http://localhost:5173/approvals`. Should show "Nenhuma aprovação pendente".

- [ ] **Step 5: Commit**

```bash
git add tools/dev-dashboard/src/
git commit -m "feat: add Approvals page with approve/reject workflow

Markdown preview for plans, diff preview for code
Filter pending/all, feedback required on reject"
```

---

## Task 9: Timeline page

**Files:**
- Create: `tools/dev-dashboard/src/pages/Timeline.tsx`
- Modify: `tools/dev-dashboard/src/App.tsx`

- [ ] **Step 1: Create pages/Timeline.tsx**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { ActivityFeed } from '../components/ActivityFeed'

export function Timeline() {
  const [activities, setActivities] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [filterAgent, setFilterAgent] = useState('')

  const reload = () => {
    const params = filterAgent ? `?agent_id=${filterAgent}&limit=100` : '?limit=100'
    api<any[]>(`/activity${params}`).then(setActivities)
  }

  useEffect(() => {
    reload()
    api<any[]>('/agents').then(setAgents)
    return subscribe(() => reload())
  }, [filterAgent])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Timeline</h1>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white/80"
        >
          <option value="">Todos os agentes</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-surface-border p-4">
        {activities.length === 0 ? (
          <div className="text-center text-white/30 py-12">Nenhuma atividade registrada</div>
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx**

```tsx
import { Timeline } from './pages/Timeline'
// ...
<Route path="/timeline" element={<Timeline />} />
```

- [ ] **Step 3: Commit**

```bash
git add tools/dev-dashboard/src/
git commit -m "feat: add Timeline page with activity feed and agent filter"
```

---

## Task 10: Start script and Desktop shortcut

**Files:**
- Create: `tools/dev-dashboard/scripts/start.sh`
- Create: `tools/dev-dashboard/scripts/create-shortcut.ps1`
- Modify: `package.json` (root)

- [ ] **Step 1: Create scripts/start.sh**

```bash
#!/bin/bash
cd "$(dirname "$0")/.."
echo "🚀 Starting GMS DevOps Dashboard..."
npm run dev
```

- [ ] **Step 2: Make start.sh executable**

```bash
chmod +x tools/dev-dashboard/scripts/start.sh
```

- [ ] **Step 3: Create scripts/create-shortcut.ps1**

```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GMS DevOps.lnk")
$Shortcut.TargetPath = "http://localhost:5173"
$Shortcut.IconLocation = "shell32.dll,14"
$Shortcut.Description = "GMS Dev Dashboard - Realtime Operations"
$Shortcut.Save()
Write-Host "Atalho criado no Desktop: GMS DevOps.lnk"
```

- [ ] **Step 4: Create the Desktop shortcut**

```bash
powershell -ExecutionPolicy Bypass -File tools/dev-dashboard/scripts/create-shortcut.ps1
```

Expected: "Atalho criado no Desktop: GMS DevOps.lnk"

- [ ] **Step 5: Commit**

```bash
git add tools/dev-dashboard/scripts/
git commit -m "feat: add start script and Desktop shortcut creator

start.sh launches server + vite in parallel
create-shortcut.ps1 creates Windows desktop shortcut to localhost:5173"
```

---

## Task 11: End-to-end integration test

- [ ] **Step 1: Start the dashboard**

```bash
cd tools/dev-dashboard && npm run dev &
sleep 4
```

- [ ] **Step 2: Test CLI → API → Dashboard flow**

```bash
# Create a task via CLI
npx tsx tools/dev-dashboard/cli/report.ts task:start \
  --agent "code-reviewer" \
  --title "Revisar pipeline de mensagens" \
  --type "review"

# Request approval via CLI
npx tsx tools/dev-dashboard/cli/report.ts approval:request \
  --agent "software-architect" \
  --type "plan" \
  --file "docs/superpowers/specs/2026-03-20-world-class-helpdesk-infra-design.md" \
  --summary "Spec do world-class helpdesk"
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`:
- Dashboard: code-reviewer should show "Ativo", metrics should update
- Task Board: Task visible in "Em Progresso" column
- Approvals: One pending approval with plan content
- Timeline: Activity entries logged

- [ ] **Step 4: Test approve/reject in browser**

On Approvals page, click "Aprovar" on the pending item. Verify:
- Approval moves to "Aprovado" status
- Task moves to "Concluído" on Task Board

- [ ] **Step 5: Stop the dashboard**

```bash
kill %1
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete dev-dashboard with end-to-end integration

Phase 1 complete: 14 agents installed, dashboard with realtime updates,
kanban board, approval system, CLI reporting, desktop shortcut"
```

---

## Summary

| Task | What it does | Estimated steps |
|------|-------------|-----------------|
| 1 | Install 14 agents from agency-agents | 6 steps |
| 2 | Scaffold Vite+React project | 10 steps |
| 3 | SQLite schema + Express server | 5 steps |
| 4 | CLI report tool | 4 steps |
| 5 | React app shell (routing, layout, WS) | 8 steps |
| 6 | Dashboard page (metrics, agents, feed) | 7 steps |
| 7 | Task Board page (kanban) | 5 steps |
| 8 | Approvals page | 5 steps |
| 9 | Timeline page | 3 steps |
| 10 | Start script + Desktop shortcut | 5 steps |
| 11 | End-to-end integration test | 6 steps |
| **Total** | | **64 steps** |

---

## Deferred to follow-up

- **AgentDetail page** (`/agents/:id`) — Individual agent view with history and metrics. Will be added after core dashboard is validated.
- **Shared types file** (`src/types.ts`) — Extract Agent, Task, Approval, Activity interfaces from components into shared file. Do during first refactor pass.
