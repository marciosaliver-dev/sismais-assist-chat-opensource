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
