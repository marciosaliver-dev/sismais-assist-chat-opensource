import { useParams, Link } from 'react-router-dom'
import { HelpSidebar } from './HelpSidebar'
import { GettingStarted } from './guides/GettingStarted'
import { AgentsGuide } from './guides/AgentsGuide'
import { RoutingGuide } from './guides/RoutingGuide'
import { AutomationsGuide } from './guides/AutomationsGuide'
import { KnowledgeBaseGuide } from './guides/KnowledgeBaseGuide'
import { TrainingGuide } from './guides/TrainingGuide'
import { TroubleshootingGuide } from './guides/TroubleshootingGuide'
import { SetupChecklist } from './SetupChecklist'
import { DiagnosticPanel } from './DiagnosticPanel'
import { Glossary } from './Glossary'
import { AIConfigAssistant } from './AIConfigAssistant'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bot, MessageCircle, X } from 'lucide-react'
import { useDiagnosticCount } from '@/hooks/useDiagnosticCount'

const sectionMeta: Record<string, { title: string; crumbs: string[] }> = {
  'getting-started': { title: 'Primeiros Passos', crumbs: ['Primeiros Passos'] },
  'setup-checklist': { title: 'Checklist de Configuração', crumbs: ['Primeiros Passos', 'Checklist'] },
  'glossary': { title: 'Glossário de Termos', crumbs: ['Primeiros Passos', 'Glossário'] },
  'agents': { title: 'Agentes IA', crumbs: ['Agentes IA'] },
  'routing': { title: 'Roteamento IA', crumbs: ['Roteamento IA'] },
  'automations': { title: 'Automações e Fluxos', crumbs: ['Automações e Fluxos'] },
  'knowledge': { title: 'Base de Conhecimento', crumbs: ['Base de Conhecimento'] },
  'training': { title: 'Treinando a IA', crumbs: ['Treinando a IA'] },
  'diagnostic': { title: 'Diagnóstico do Sistema', crumbs: ['Diagnóstico'] },
  'troubleshooting': { title: 'Problemas e Soluções', crumbs: ['Diagnóstico', 'Problemas'] },
}

function renderContent(section: string, subsection: string) {
  if (section === 'setup-checklist') return <SetupChecklist />
  if (section === 'glossary') return <Glossary />
  if (section === 'diagnostic') return <DiagnosticPanel />
  if (section === 'agents') return <AgentsGuide subsection={subsection} />
  if (section === 'routing') return <RoutingGuide subsection={subsection} />
  if (section === 'automations') return <AutomationsGuide subsection={subsection} />
  if (section === 'knowledge') return <KnowledgeBaseGuide subsection={subsection} />
  if (section === 'training') return <TrainingGuide subsection={subsection} />
  if (section === 'troubleshooting') return <TroubleshootingGuide subsection={subsection} />
  return <GettingStarted subsection={subsection} />
}

export function HelpLayout() {
  const { section = 'getting-started', subsection = '' } = useParams<{
    section?: string
    subsection?: string
  }>()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { count: diagnosticCount } = useDiagnosticCount()

  const meta = sectionMeta[section] ?? { title: 'Central de Configuração IA', crumbs: [] }

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* Inner sidebar */}
      <HelpSidebar diagnosticCount={diagnosticCount} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/help" className="hover:text-foreground transition-colors">
              Central de Config.
            </Link>
            {meta.crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span>/</span>
                <span className={i === meta.crumbs.length - 1 ? 'text-foreground font-medium' : ''}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        </div>

        {/* Page content */}
        <div className="flex-1 p-6 max-w-4xl">
          {renderContent(section, subsection)}
        </div>
      </div>

      {/* Floating assistant button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {assistantOpen && (
          <div className="w-[420px] h-[560px] rounded-xl border border-border shadow-2xl bg-background overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar">
              <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-sidebar-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-sidebar-foreground">Assistente de Configuração</p>
                <p className="text-xs text-sidebar-foreground/60">Tire dúvidas sobre o sistema</p>
              </div>
              <button
                onClick={() => setAssistantOpen(false)}
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AIConfigAssistant />
          </div>
        )}
        <Button
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar"
          onClick={() => setAssistantOpen(!assistantOpen)}
          title="Assistente de Configuração IA"
        >
          {assistantOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <MessageCircle className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  )
}
