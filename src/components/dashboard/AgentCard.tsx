import { Card, CardContent } from '@/components/ui/card'
import { Activity } from 'lucide-react'

interface AgentCardProps {
  agent: {
    id: string
    name: string
    specialty: string
    color: string | null
    is_active: boolean | null
    todayConversations: number
    todaySuccessRate: number
  }
}

import { specialtyMap } from '@/components/agents/agent-specialties'

export function AgentCard({ agent }: AgentCardProps) {
  const spec = specialtyMap[agent.specialty] || { emoji: '🤖', label: agent.specialty }

  return (
    <Card className="border-border hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: `${agent.color || '#45E5E5'}20` }}
            >
              {spec.emoji}
            </div>
            <div>
              <p className="font-medium text-[#10293F] dark:text-foreground text-sm">{agent.name}</p>
              <p className="text-xs text-muted-foreground">{spec.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{agent.todayConversations} conversas</p>
              <div className="flex items-center gap-1 justify-end">
                <Activity className="w-3 h-3 text-[#16A34A]" />
                <span className="text-xs font-medium text-[#10293F] dark:text-foreground">{agent.todaySuccessRate}%</span>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              agent.is_active
                ? 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]'
                : 'bg-[#F5F5F5] text-[#666666] border-[#E5E5E5]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${agent.is_active ? 'bg-[#16A34A]' : 'bg-[#CCCCCC]'}`} />
              {agent.is_active ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
