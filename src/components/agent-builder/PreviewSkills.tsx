import { Check, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

interface Skill {
  id: string
  name: string
  description?: string
  category?: string
}

interface PreviewSkillsProps {
  config: AgentConfig
  availableSkills: Skill[]
  onToggle: (skillId: string) => void
  onAskExplanation: (question: string) => void
}

export default function PreviewSkills({ config, availableSkills, onToggle, onAskExplanation }: PreviewSkillsProps) {
  const activeCount = config.skills.filter(s => availableSkills.some(a => a.id === s)).length

  if (availableSkills.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center italic">Nenhuma skill disponível.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {activeCount}/{availableSkills.length} ativas
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {availableSkills.map(skill => {
          const isActive = config.skills.includes(skill.id)
          return (
            <div key={skill.id} className="flex items-center gap-0.5">
              <button
                onClick={() => onToggle(skill.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  isActive
                    ? 'bg-[#E8F9F9] border-[#45E5E5] text-[#10293F]'
                    : 'bg-muted border-border text-muted-foreground hover:border-[#45E5E5]/50 hover:text-foreground'
                )}
                aria-pressed={isActive}
                title={skill.description}
              >
                {isActive && <Check className="w-3 h-3 text-[#10293F]" />}
                {skill.name}
              </button>
              <button
                onClick={() => onAskExplanation(`O que faz a skill "${skill.name}"?`)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-[#45E5E5] transition-colors"
                aria-label={`Explicar skill ${skill.name}`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
