import { useState } from 'react'
import { ChevronDown, Settings, Database, Zap, FileText, Shield, AlertTriangle, GraduationCap } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { AgentLLMConfig } from './AgentLLMConfig'
import { AgentRAGConfig } from './AgentRAGConfig'
import { AgentSkills } from './AgentSkills'
import { AgentTools } from './AgentTools'
import { AgentBriefing } from './AgentBriefing'
import { AgentPolicies } from './AgentPolicies'
import { AgentGuardrails } from './AgentGuardrails'
import { AgentQATraining } from './AgentQATraining'
import type { TablesInsert } from '@/integrations/supabase/types'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
  supportConfig: Record<string, any>
  onSupportConfigChange: (updates: Record<string, any>) => void
  agentId?: string
}

function AdvancedSection({ title, description, icon: Icon, defaultOpen = false, children }: {
  title: string
  description: string
  icon: React.ElementType
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4 pb-2 px-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AgentAdvanced({ data, onChange, supportConfig, onSupportConfigChange, agentId }: Props) {
  return (
    <div className="space-y-3">
      <AdvancedSection
        title="Modelo e Parâmetros"
        description="Configurações do LLM, temperatura, tokens e modelo"
        icon={Settings}
      >
        <AgentLLMConfig data={data} onChange={onChange} specialty={data.specialty} />
      </AdvancedSection>

      <AdvancedSection
        title="RAG e Base de Conhecimento"
        description="Retrieval-Augmented Generation e documentos indexados"
        icon={Database}
      >
        <AgentRAGConfig data={data} onChange={onChange} />
      </AdvancedSection>

      <AdvancedSection
        title="Skills & Ferramentas"
        description="Habilidades do agente e function calling"
        icon={Zap}
      >
        <AgentSkills agentId={agentId} />
        <Separator className="my-4" />
        <h3 className="text-sm font-medium mb-3">Ferramentas (Function Calling)</h3>
        <AgentTools data={data} onChange={onChange} />
      </AdvancedSection>

      <AdvancedSection
        title="Conhecimento da Empresa"
        description="Briefing, contexto e informações do negócio"
        icon={FileText}
      >
        <AgentBriefing data={supportConfig} onChange={onSupportConfigChange} />
      </AdvancedSection>

      <AdvancedSection
        title="Políticas e Restrições"
        description="Regras de atendimento, horários e limites"
        icon={Shield}
      >
        <AgentPolicies data={supportConfig} onChange={onSupportConfigChange} />
      </AdvancedSection>

      <AdvancedSection
        title="Guardrails"
        description="Filtros de segurança, moderação e validações"
        icon={AlertTriangle}
      >
        <AgentGuardrails agentId={agentId} data={data} onChange={onChange} />
      </AdvancedSection>

      <AdvancedSection
        title="Treinamento Q&A"
        description="Perguntas e respostas para fine-tuning do agente"
        icon={GraduationCap}
      >
        <AgentQATraining agentId={agentId} />
      </AdvancedSection>
    </div>
  )
}
