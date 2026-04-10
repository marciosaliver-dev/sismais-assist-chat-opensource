import { useState } from 'react'
import { ChevronDown, ChevronUp, User, Zap, Wrench, MessageCircle, BookOpen, Settings2, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import PreviewPersonality from './PreviewPersonality'
import PreviewSkills from './PreviewSkills'
import PreviewTools from './PreviewTools'
import PreviewChannels from './PreviewChannels'
import PreviewKnowledge from './PreviewKnowledge'
import PreviewConfig from './PreviewConfig'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

interface BuilderPreviewProps {
  config: AgentConfig
  builderContext: {
    available_skills: any[]
    available_tools: any[]
    available_products: any[]
    available_instances: any[]
  } | undefined
  toggleSkill: (id: string) => void
  toggleTool: (id: string) => void
  toggleInstance: (id: string) => void
  updateConfig: (updates: Partial<AgentConfig>) => void
  onAskExplanation: (question: string) => void
  onStartTest: () => void
}

interface SectionProps {
  icon: React.ReactNode
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ icon, title, badge, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="text-xs bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] px-1.5 py-0.5 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>
      {open && (
        <div className="border-t border-border bg-background">
          {children}
        </div>
      )}
    </div>
  )
}

export default function BuilderPreview({
  config,
  builderContext,
  toggleSkill,
  toggleTool,
  toggleInstance,
  updateConfig,
  onAskExplanation,
  onStartTest,
}: BuilderPreviewProps) {
  const ctx = builderContext || {
    available_skills: [],
    available_tools: [],
    available_products: [],
    available_instances: [],
  }

  const activeSkills = config.skills.filter(s => ctx.available_skills.some(a => a.id === s)).length
  const activeTools = config.tools.filter(t => ctx.available_tools.some(a => a.id === t)).length
  const activeInstances = config.whatsapp_instances.filter(i => ctx.available_instances.some(a => a.id === i)).length

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <Section icon={<User className="w-4 h-4" />} title="Personalidade" defaultOpen>
            <PreviewPersonality config={config} />
          </Section>

          <Section
            icon={<Zap className="w-4 h-4" />}
            title="Skills"
            badge={activeSkills > 0 ? `${activeSkills}/${ctx.available_skills.length}` : undefined}
          >
            <PreviewSkills
              config={config}
              availableSkills={ctx.available_skills}
              onToggle={toggleSkill}
              onAskExplanation={onAskExplanation}
            />
          </Section>

          <Section
            icon={<Wrench className="w-4 h-4" />}
            title="Ferramentas"
            badge={activeTools > 0 ? `${activeTools}/${ctx.available_tools.length}` : undefined}
          >
            <PreviewTools
              config={config}
              availableTools={ctx.available_tools}
              onToggle={toggleTool}
              onAskExplanation={onAskExplanation}
            />
          </Section>

          <Section
            icon={<MessageCircle className="w-4 h-4" />}
            title="Canais WhatsApp"
            badge={activeInstances > 0 ? `${activeInstances} instância${activeInstances > 1 ? 's' : ''}` : undefined}
          >
            <PreviewChannels
              config={config}
              availableInstances={ctx.available_instances}
              onToggle={toggleInstance}
            />
          </Section>

          <Section icon={<BookOpen className="w-4 h-4" />} title="Base de Conhecimento">
            <PreviewKnowledge
              config={config}
              availableProducts={ctx.available_products}
              onChange={updateConfig}
            />
          </Section>

          <Section icon={<Settings2 className="w-4 h-4" />} title="Config Avançado">
            <PreviewConfig config={config} onChange={updateConfig} />
          </Section>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 flex-shrink-0">
        <Button
          onClick={onStartTest}
          className="w-full gap-2 bg-[#10293F] hover:bg-[#1a3d5c] text-white h-10"
          variant="secondary"
        >
          <FlaskConical className="w-4 h-4" />
          Testar Agente
        </Button>
      </div>
    </div>
  )
}
