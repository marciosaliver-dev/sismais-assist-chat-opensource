import { useAgentSkills } from '@/hooks/useAgentSkills'
import { useAgentSkillAssignments } from '@/hooks/useAgentSkills'
import { SkillCard } from '../skills/SkillCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

interface Props {
  agentId?: string
}

const categoryOrder = ['atendimento', 'tecnico', 'financeiro', 'vendas', 'interno', 'general']
const categoryLabels: Record<string, string> = {
  atendimento: 'Atendimento',
  financeiro: 'Financeiro',
  vendas: 'Vendas',
  tecnico: 'Técnico',
  interno: 'Interno',
  general: 'Geral',
}

function EmptySkills() {
  const navigate = useNavigate()
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm mb-3">Nenhuma skill cadastrada.</p>
      <Button variant="outline" size="sm" onClick={() => navigate('/skills')}>
        Gerenciar Skills
      </Button>
    </div>
  )
}

export function AgentSkills({ agentId }: Props) {
  const { skills, skillsLoading } = useAgentSkills()
  const { assignments, assignmentsLoading, toggleSkill } = useAgentSkillAssignments(agentId)

  if (!agentId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Salve o agente primeiro para atribuir skills</p>
      </div>
    )
  }

  if (skillsLoading || assignmentsLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando skills...</div>
  }

  const assignmentMap = new Map(
    assignments.map(a => [a.skill_id, a])
  )

  const enabledCount = assignments.filter(a => a.is_enabled).length

  // Group skills by category
  const grouped = new Map<string, typeof skills>()
  for (const skill of skills) {
    if (!skill.is_active) continue
    const cat = skill.category || 'general'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(skill)
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  )

  const handleToggle = async (skillId: string, enabled: boolean) => {
    try {
      await toggleSkill.mutateAsync({ agentId: agentId!, skillId, isEnabled: enabled })
      toast.success(enabled ? 'Skill ativada' : 'Skill desativada')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar skill')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-foreground">Skills do Agente</p>
        <p className="text-xs text-muted-foreground">
          Ative as habilidades que este agente deve ter. Skills ativas injetam instruções no prompt.
        </p>
        {enabledCount > 0 && (
          <Badge variant="default" className="mt-2">{enabledCount} skill{enabledCount !== 1 ? 's' : ''} ativa{enabledCount !== 1 ? 's' : ''}</Badge>
        )}
      </div>

      {sortedCategories.map(cat => (
        <div key={cat}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {categoryLabels[cat] || cat}
          </p>
          <div className="space-y-2">
            {grouped.get(cat)!.map(skill => {
              const assignment = assignmentMap.get(skill.id)
              const isEnabled = assignment?.is_enabled ?? false

              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  compact
                  isAssigned={!!assignment}
                  isEnabled={isEnabled}
                  onToggle={(enabled) => handleToggle(skill.id, enabled)}
                />
              )
            })}
          </div>
        </div>
      ))}

      {skills.length === 0 && (
        <EmptySkills />
      )}
    </div>
  )
}
