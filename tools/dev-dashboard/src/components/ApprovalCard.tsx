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
