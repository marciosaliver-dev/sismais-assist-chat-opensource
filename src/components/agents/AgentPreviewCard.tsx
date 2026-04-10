import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Bot, Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TablesInsert } from '@/integrations/supabase/types'

interface Props {
  formData: Partial<TablesInsert<'ai_agents'>>
  supportConfig: Record<string, any>
  onNavigate: (tabId: string) => void
}

export function AgentPreviewCard({ formData, supportConfig, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const items = [
    { label: formData.name || 'Sem nome', detail: formData.specialty || '—', tabId: 'profile', done: !!(formData.name && formData.specialty) },
    { label: 'Modelo', detail: formData.model?.split('/').pop() || '—', tabId: 'model', done: !!formData.model },
    { label: 'RAG', detail: formData.rag_enabled ? `Top ${formData.rag_top_k || 5}` : 'Desabilitado', tabId: 'rag', done: true },
    { label: 'Prompt', detail: formData.system_prompt ? `${formData.system_prompt.length} chars` : 'Vazio', tabId: 'behavior', done: !!formData.system_prompt },
  ]

  const completedSteps = items.filter(i => i.done).length

  return (
    <div className="border rounded-lg bg-card mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="truncate max-w-[140px]">{formData.name || 'Novo Agente'}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{completedSteps}/{items.length}</Badge>
        </div>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 space-y-1 border-t">
          {items.map(item => (
            <button key={item.tabId} onClick={() => onNavigate(item.tabId)}
              className="w-full flex items-center gap-2 text-[11px] py-1 hover:bg-muted/50 rounded px-1 transition-colors">
              {item.done ? <Check className="w-3 h-3 text-green-500 shrink-0" /> : <Minus className="w-3 h-3 text-muted-foreground shrink-0" />}
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="truncate font-medium">{item.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
