import { AgentPreviewCard } from './AgentPreviewCard'
import { SkillPreviewCard } from './SkillPreviewCard'
import type { BuilderMode, BuilderState } from '@/hooks/useAIBuilder'

interface Props {
  mode: BuilderMode
  partialConfig: Record<string, any>
  finalConfig: Record<string, any> | null
  state: BuilderState
  methods: string[]
  onMethodsChange: (m: string[]) => void
  onCreateAgent: () => void
  onCreateSkill: () => void
  onOpenEditor: () => void
  isCreating: boolean
  isRetrain?: boolean
}

export function BuilderPreview({
  mode, partialConfig, finalConfig, state, methods, onMethodsChange,
  onCreateAgent, onCreateSkill, onOpenEditor, isCreating, isRetrain,
}: Props) {
  const config = finalConfig || partialConfig
  const isPreview = state === 'preview'

  if (mode === 'agent') {
    return (
      <div className="p-4 h-full overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview do Agente</p>
        <AgentPreviewCard
          config={config}
          methods={methods}
          onMethodsChange={onMethodsChange}
          onCreateAgent={onCreateAgent}
          onOpenEditor={onOpenEditor}
          isCreating={isCreating}
          isPreview={isPreview}
          isRetrain={isRetrain}
        />
      </div>
    )
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview da Skill</p>
      <SkillPreviewCard
        config={config}
        onCreateSkill={onCreateSkill}
        onOpenEditor={onOpenEditor}
        isCreating={isCreating}
        isPreview={isPreview}
      />
    </div>
  )
}
