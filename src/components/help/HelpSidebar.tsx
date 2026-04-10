import { Link, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Rocket,
  Bot,
  GitBranch,
  Zap,
  BookOpen,
  GraduationCap,
  AlertCircle,
  ChevronDown,
  BookMarked,
} from 'lucide-react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface NavItem {
  label: string
  section: string
  subsection: string
}

interface NavGroup {
  icon: typeof Rocket
  label: string
  section: string
  items: NavItem[]
  badge?: number
}

const navGroups: NavGroup[] = [
  {
    icon: Rocket,
    label: 'Primeiros Passos',
    section: 'getting-started',
    items: [
      { label: 'Como a IA funciona', section: 'getting-started', subsection: 'how-it-works' },
      { label: 'Checklist de configuração', section: 'setup-checklist', subsection: '' },
      { label: 'Glossário de termos', section: 'glossary', subsection: '' },
    ],
  },
  {
    icon: Bot,
    label: 'Agentes IA',
    section: 'agents',
    items: [
      { label: 'O que é um Agente IA', section: 'agents', subsection: 'what-is' },
      { label: 'Criando seu primeiro Agente', section: 'agents', subsection: 'create' },
      { label: 'Personalidade (System Prompt)', section: 'agents', subsection: 'personality' },
      { label: 'Conectando Base de Conhecimento', section: 'agents', subsection: 'rag' },
      { label: '⚠️ Erros comuns', section: 'agents', subsection: 'errors' },
    ],
  },
  {
    icon: GitBranch,
    label: 'Roteamento IA',
    section: 'routing',
    items: [
      { label: 'Como o sistema decide o agente', section: 'routing', subsection: 'how-it-works' },
      { label: 'Melhorando o roteamento', section: 'routing', subsection: 'improve' },
      { label: 'Fallback e escalação', section: 'routing', subsection: 'fallback' },
      { label: '⚠️ Agente não responde?', section: 'routing', subsection: 'troubleshoot' },
    ],
  },
  {
    icon: Zap,
    label: 'Automações e Fluxos',
    section: 'automations',
    items: [
      { label: 'Automações vs Flow Builder', section: 'automations', subsection: 'difference' },
      { label: 'Triggers disponíveis', section: 'automations', subsection: 'triggers' },
      { label: 'Ações disponíveis', section: 'automations', subsection: 'actions' },
      { label: '⚠️ Respostas duplicadas', section: 'automations', subsection: 'duplicates' },
    ],
  },
  {
    icon: BookOpen,
    label: 'Base de Conhecimento',
    section: 'knowledge',
    items: [
      { label: 'Como a IA usa os artigos', section: 'knowledge', subsection: 'how-rag-works' },
      { label: 'Boas práticas para artigos', section: 'knowledge', subsection: 'best-practices' },
      { label: 'Verificando se funciona', section: 'knowledge', subsection: 'verify' },
    ],
  },
  {
    icon: GraduationCap,
    label: 'Treinando a IA',
    section: 'training',
    items: [
      { label: 'Ciclo de treinamento', section: 'training', subsection: 'cycle' },
      { label: 'Melhorando respostas', section: 'training', subsection: 'improve' },
      { label: 'Métricas de confiança', section: 'training', subsection: 'metrics' },
    ],
  },
  {
    icon: AlertCircle,
    label: 'Diagnóstico',
    section: 'diagnostic',
    items: [
      { label: 'Painel de diagnóstico', section: 'diagnostic', subsection: '' },
      { label: 'IA não responde', section: 'troubleshooting', subsection: 'not-responding' },
      { label: 'IA responde errado', section: 'troubleshooting', subsection: 'wrong-answers' },
      { label: 'Resposta duplicada', section: 'troubleshooting', subsection: 'duplicate' },
    ],
  },
]

interface HelpSidebarProps {
  diagnosticCount?: number
}

export function HelpSidebar({ diagnosticCount = 0 }: HelpSidebarProps) {
  const { section = 'getting-started', subsection = '' } = useParams<{
    section?: string
    subsection?: string
  }>()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    navGroups.forEach((g) => {
      const isCurrentGroup =
        g.section === section || g.items.some((i) => i.section === section)
      initial[g.section] = isCurrentGroup
    })
    return initial
  })

  const toggleGroup = (groupSection: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupSection]: !prev[groupSection] }))
  }

  const isItemActive = (item: NavItem) => {
    if (item.subsection) {
      return item.section === section && item.subsection === subsection
    }
    return item.section === section && !subsection
  }

  const getHref = (item: NavItem) => {
    if (item.subsection) return `/help/${item.section}/${item.subsection}`
    return `/help/${item.section}`
  }

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-sidebar-border/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-sidebar-primary/20 flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-sidebar-foreground/90 leading-tight">Central de</p>
            <p className="text-xs font-bold text-sidebar-primary leading-tight">Configuração IA</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navGroups.map((group) => {
          const Icon = group.icon
          const isOpen = openGroups[group.section] ?? false
          const isGroupActive = group.section === section || group.items.some((i) => i.section === section)
          const showDiagnosticBadge = group.section === 'diagnostic' && diagnosticCount > 0

          return (
            <Collapsible
              key={group.section}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.section)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg text-sm px-3 py-2 transition-colors duration-150',
                    isGroupActive
                      ? 'bg-sidebar-primary/15 text-sidebar-primary border-l-[3px] border-sidebar-primary font-semibold'
                      : 'border-l-[3px] border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground font-medium'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left text-xs">{group.label}</span>
                  {showDiagnosticBadge && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {diagnosticCount}
                    </span>
                  )}
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-3 pl-3 border-l border-sidebar-border/40 space-y-0.5 my-0.5">
                  {group.items.map((item) => {
                    const active = isItemActive(item)
                    return (
                      <Link
                        key={`${item.section}-${item.subsection}`}
                        to={getHref(item)}
                        className={cn(
                          'flex items-center text-xs py-1.5 px-2 rounded-md transition-colors duration-100',
                          active
                            ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
                            : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20'
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </nav>
    </aside>
  )
}
