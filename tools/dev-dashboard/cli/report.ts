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
