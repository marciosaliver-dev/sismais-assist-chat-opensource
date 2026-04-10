import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import logoIcon from '@/assets/logo-sismais-icon-new.png'
import logoHorizontal from '@/assets/logo-sismais-horizontal-white.png'
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Zap,
  Settings,
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
  Columns,
  BarChart3,
  Settings2,
  Users2,
  ChevronDown,
  Contact,
  FileText,
  ShieldCheck,
  Plug,
  Megaphone,
  HelpCircle,
  PlayCircle,
  Package,
  Library,
  ListTodo,
  Search,
  LogOut,
  FileSearch,
  Building2,
  PieChart,
  Key,
  Wand2,
  Bell,
  BookOpen,
  MessageSquarePlus,
  Tv,
  ExternalLink,
  Wrench,
  Brain,
} from 'lucide-react'
import { useDiagnosticCount } from '@/hooks/useDiagnosticCount'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import * as LucideIcons from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { useSystemUpdates } from '@/hooks/useSystemUpdates'
import { usePendingMessages } from '@/hooks/usePendingMessages'
import { useQueueCountsByBoard } from '@/hooks/useQueueCountsByBoard'

import type { RolePermissions } from '@/types/auth'

type MenuItem = { icon: typeof LayoutDashboard; label: string; path: string; permission?: keyof RolePermissions; openInNewTab?: boolean }
type MenuCategory = { category: string; items: MenuItem[]; permission?: keyof RolePermissions }

// Menu visível para TODOS os usuários (equipe geral)
const menuCategories: MenuCategory[] = [
  {
    category: 'Atendimento',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: MessageSquare, label: 'Inbox', path: '/inbox' },
      { icon: ListTodo, label: 'Avaliações', path: '/evaluations' },
    ],
  },
  {
    category: 'Clientes',
    items: [
      { icon: Users2, label: 'Clientes', path: '/clients' },
      { icon: Contact, label: 'Contatos', path: '/contacts' },
    ],
  },
  {
    category: 'Conhecimento',
    items: [
      { icon: Library, label: 'Base de Conhecimento', path: '/knowledge', permission: 'viewKnowledgeBase' },
      { icon: Building2, label: 'Conhecimento da Empresa', path: '/company-knowledge', permission: 'manageKnowledgeBase' },
    ],
  },
  {
    category: 'Conteúdo',
    permission: 'manageKnowledgeBase',
    items: [
      { icon: HelpCircle, label: 'Central do Cliente', path: '/admin/help', permission: 'manageKnowledgeBase' },
      { icon: FileText, label: 'Manuais', path: '/admin/manuais', permission: 'manageKnowledgeBase' },
      { icon: PlayCircle, label: 'Vídeos', path: '/admin/help/videos', permission: 'manageKnowledgeBase' },
    ],
  },
  {
    category: 'Gestão',
    permission: 'manageCategories',
    items: [
      { icon: ListTodo, label: 'Categorias', path: '/settings?tab=categories', permission: 'manageCategories' },
      { icon: FileText, label: 'Módulos / Procedimentos', path: '/settings?tab=modules', permission: 'manageModules' },
      { icon: FileText, label: 'Macros', path: '/macros', permission: 'manageMacros' },
      { icon: Package, label: 'Catálogo de Serviços', path: '/service-catalog', permission: 'manageServiceCatalog' },
    ],
  },
  {
    category: 'Aprendizado',
    items: [
      { icon: BookOpen, label: 'Manuais', path: '/manual', openInNewTab: true },
    ],
  },
  {
    category: 'Sistema',
    items: [
      { icon: Bell, label: 'Atualizações', path: '/updates' },
      { icon: MessageSquarePlus, label: 'Solicitações', path: '/feedback' },
    ],
  },
  {
    category: 'Relatórios',
    permission: 'viewReports',
    items: [
      { icon: FileSearch, label: 'Tickets', path: '/reports/tickets', permission: 'viewReports' },
      { icon: Building2, label: 'Volume por Empresa', path: '/reports/company-volume', permission: 'viewReports' },
      { icon: PieChart, label: 'Executivo', path: '/reports/executive', permission: 'viewReports' },
      { icon: Tv, label: 'Dashboard TV', path: '/tv-dashboard', permission: 'viewReports' },
    ],
  },
]

// Menu ADMIN — subgrupos colapsáveis (só role === 'admin')
type AdminSubgroup = { label: string; icon: typeof Bot; items: MenuItem[] }

const adminSubgroups: AdminSubgroup[] = [
  {
    label: 'IA & Automação',
    icon: Bot,
    items: [
      { icon: Bot, label: 'Agentes IA', path: '/agents' },
      { icon: Wand2, label: 'AI Builder', path: '/ai-builder' },
      { icon: ShieldCheck, label: 'Supervisão', path: '/supervisor' },
      { icon: Zap, label: 'Automações', path: '/automations' },
      { icon: PlayCircle, label: 'Skills', path: '/skills' },
      { icon: Megaphone, label: 'Campanhas', path: '/campaigns' },
    ],
  },
  {
    label: 'Configuração',
    icon: Settings,
    items: [
      { icon: Settings, label: 'Geral', path: '/settings' },
      { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp-instances' },
      { icon: Settings2, label: 'Config. IA', path: '/ai-settings' },
      { icon: Wrench, label: 'Ferramentas IA', path: '/ai-tools' },
      { icon: Brain, label: 'CTO Advisor', path: '/cto-advisor' },
      { icon: Brain, label: 'AI Lab', path: '/ai-lab' },
      { icon: BarChart3, label: 'Consumo IA', path: '/ai-consumption' },
      { icon: FileSearch, label: 'Log de API', path: '/api-logs' },
    ],
  },
  {
    label: 'Sistema',
    icon: Plug,
    items: [
      { icon: Users2, label: 'Equipe & Acessos', path: '/admin/users' },
      { icon: Plug, label: 'Integrações', path: '/admin/integrations' },
      { icon: Key, label: 'API Parceiros', path: '/admin/api-keys' },
      { icon: ShieldCheck, label: 'Auditoria IA', path: '/admin/audit' },
    ],
  },
]

function getBoardIcon(iconName?: string | null) {
  if (!iconName) return Columns
  const name = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }> | undefined
  return Icon || Columns
}

function openCommandPalette() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [kanbanOpen, setKanbanOpen] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const { data: boards = [] } = useKanbanBoards()
  const queueCountsByBoard = useQueueCountsByBoard()
  const { user, hasPermission } = useAuth()
  const { user: supaUser, signOut } = useSupabaseAuth()
  const isAdmin = user?.role === 'admin'
  const { count: diagnosticCount } = useDiagnosticCount()
  const { totalPendingCount } = usePendingMessages()
  const { unreadCount: updatesUnread } = useSystemUpdates()


  const agentName = supaUser?.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Agente'

  const isKanbanActive = location.pathname.startsWith('/kanban')

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon
    const isActive = location.pathname === item.path ||
      (item.path === '/' && location.pathname === '/dashboard') ||
      (item.path === '/automations' && location.pathname.startsWith('/flow-builder')) ||
      (item.path === '/help' && location.pathname.startsWith('/help')) ||
      (item.path === '/admin/help' && location.pathname.startsWith('/admin/help')) ||
      (item.path === '/admin/manuais' && location.pathname.startsWith('/admin/manuais'))
    const showDiagnosticBadge = item.path === '/help' && diagnosticCount > 0
    const showInboxBadge = false
    const showUpdatesBadge = item.path === '/updates' && updatesUnread > 0

    const linkClasses = cn(
      'relative w-full flex items-center gap-3 rounded-lg text-sm transition-colors duration-150',
      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
      isActive
        ? 'bg-sidebar-primary/15 text-white font-semibold border-l-[3px] border-sidebar-primary'
        : 'border-l-[3px] border-transparent font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-accent-foreground'
    )

    const LinkTag = item.openInNewTab ? 'a' : Link
    const linkProps = item.openInNewTab
      ? { href: item.path, target: '_blank' as const, rel: 'noopener noreferrer' }
      : { to: item.path }

    const linkContent = (
      <LinkTag {...linkProps as any} className={linkClasses}>
        <Icon className={cn('w-4.5 h-4.5 shrink-0', isActive ? 'text-sidebar-primary' : '')} />
        {!collapsed && <span className="flex-1">{item.label}</span>}
        {!collapsed && showInboxBadge && (
          <span className="min-w-[20px] h-5 rounded-full bg-[#45E5E5] text-[#10293F] text-xs font-bold flex items-center justify-center px-1 shrink-0">
            {totalPendingCount > 99 ? '99+' : totalPendingCount}
          </span>
        )}
        {collapsed && showInboxBadge && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-[#45E5E5] border border-sidebar" />
        )}
        {!collapsed && showDiagnosticBadge && (
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {diagnosticCount > 9 ? '9+' : diagnosticCount}
          </span>
        )}
        {collapsed && showDiagnosticBadge && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-500 border border-sidebar" />
        )}
        {!collapsed && showUpdatesBadge && (
          <span className="min-w-[20px] h-5 rounded-full bg-[#45E5E5] text-[#10293F] text-[10px] font-bold flex items-center justify-center px-1.5 shrink-0">
            {updatesUnread > 9 ? '9+' : updatesUnread}
          </span>
        )}
        {collapsed && showUpdatesBadge && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-[#45E5E5] border border-sidebar" />
        )}
      </LinkTag>
    )

    if (collapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground">{item.label}</TooltipContent>
        </Tooltip>
      )
    }

    if (item.path === '/tv-dashboard') {
      return (
        <div key={item.path} className="group/tv-item relative">
          {linkContent}
          <button
            type="button"
            aria-label="Abrir Dashboard TV em nova aba"
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/tv-item:opacity-100 transition-opacity duration-150 p-1 rounded hover:bg-sidebar-accent/30"
            onClick={(e) => { e.stopPropagation(); window.open('/tv', '_blank'); }}
          >
            <ExternalLink className="w-3.5 h-3.5 text-sidebar-foreground/70" />
          </button>
        </div>
      )
    }

    return <div key={item.path}>{linkContent}</div>
  }

  const renderKanbanSubmenu = () => {
    if (collapsed) {
      return (
        <Tooltip key="kanban-collapsed">
          <TooltipTrigger asChild>
            <Link
              to={boards[0]?.slug ? `/kanban/${boards[0].slug}` : '/kanban/support'}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg text-sm transition-colors duration-150 justify-center px-2 py-2.5',
                isKanbanActive
                  ? 'bg-sidebar-primary/15 text-white font-semibold border-l-[3px] border-sidebar-primary'
                  : 'border-l-[3px] border-transparent font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-accent-foreground'
              )}
            >
              <Columns className="w-5 h-5 shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground">Kanban</TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Collapsible key="kanban-expanded" open={kanbanOpen} onOpenChange={setKanbanOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 rounded-lg text-sm transition-colors duration-150 px-3 py-2',
              isKanbanActive
                ? 'bg-sidebar-primary/15 text-white font-semibold border-l-[3px] border-sidebar-primary'
                : 'border-l-[3px] border-transparent font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-accent-foreground'
            )}
          >
            <Columns className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">Kanban</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', kanbanOpen && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-5 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-0.5">
            {boards.map(board => {
              const BoardIcon = getBoardIcon(board.icon)
              const boardActive = location.pathname === `/kanban/${board.slug}`
              return (
                <Link
                  key={board.id}
                  to={`/kanban/${board.slug}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md text-sm py-2 px-2.5 transition-colors duration-100 border-l-2',
                    boardActive
                      ? 'bg-sidebar-accent/40 text-sidebar-accent-foreground font-medium'
                      : 'border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground'
                  )}
                  style={boardActive ? { borderLeftColor: board.color } : undefined}
                >
                  <BoardIcon className="w-4 h-4 shrink-0" style={{ color: boardActive ? board.color : undefined }} />
                  <span className="truncate flex-1">{board.name}</span>
                  {(queueCountsByBoard[board.id] ?? 0) > 0 && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-[#45E5E5] text-[#10293F] text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                      {queueCountsByBoard[board.id] > 99 ? '99+' : queueCountsByBoard[board.id]}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'bg-sidebar text-sidebar-foreground flex flex-col h-screen shrink-0 transition-all duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn("border-b border-sidebar-border/60 bg-gradient-to-r from-sidebar-accent/30 to-transparent flex items-center", collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3.5')}>
          {collapsed ? (
            <img src={logoIcon} alt="Sismais" className="h-8 shrink-0 object-contain" />
          ) : (
            <img src={logoHorizontal} alt="Sismais" className="h-8 object-contain" />
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
          {menuCategories.map((group) => {
            // Skip entire category if user lacks the category-level permission
            if (group.permission && !hasPermission(group.permission)) return null

            // Filter items by permission
            const visibleItems = group.items.filter(item => !item.permission || hasPermission(item.permission))
            if (visibleItems.length === 0 && group.category !== 'Atendimento') return null

            return (
              <div key={group.category}>
                {!collapsed && (
                  <p className="px-3 pt-4 pb-1.5 text-xs font-semibold text-sidebar-foreground/50 tracking-widest uppercase">
                    {group.category}
                  </p>
                )}

                {group.category === 'Atendimento' ? (
                  <>
                    {visibleItems.map(renderMenuItem)}
                    {renderKanbanSubmenu()}
                  </>
                ) : (
                  visibleItems.map(renderMenuItem)
                )}
              </div>
            )
          })}

          {/* Admin section */}
          {isAdmin && (
            <div>
              {!collapsed && (
                <p className="px-3 pt-4 pb-1.5 text-xs font-semibold text-sidebar-foreground/50 tracking-widest uppercase">
                  Administração
                </p>
              )}
              {adminSubgroups.map((subgroup) => {
                const SubIcon = subgroup.icon
                const hasActiveItem = subgroup.items.some(item => location.pathname === item.path)

                if (collapsed) {
                  // No modo colapsado, mostrar apenas os itens direto
                  return subgroup.items.map(renderMenuItem)
                }

                return (
                  <Collapsible key={subgroup.label} defaultOpen={hasActiveItem}>
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          'w-full flex items-center gap-3 rounded-lg text-sm transition-colors duration-150 px-3 py-2',
                          hasActiveItem
                            ? 'text-white font-semibold'
                            : 'font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/20 hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <SubIcon className={cn('w-4.5 h-4.5 shrink-0', hasActiveItem && 'text-sidebar-primary')} />
                        <span className="flex-1 text-left">{subgroup.label}</span>
                        <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>&]:rotate-180 text-sidebar-foreground/40" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-5 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-0.5">
                        {subgroup.items.map((item) => {
                          const Icon = item.icon
                          const isActive = location.pathname === item.path
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={cn(
                                'flex items-center gap-2.5 rounded-md text-sm py-1.5 px-2.5 transition-colors duration-100',
                                isActive
                                  ? 'bg-sidebar-primary/15 text-white font-medium'
                                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/20 hover:text-sidebar-accent-foreground'
                              )}
                            >
                              <Icon className={cn('w-4 h-4 shrink-0', isActive && 'text-sidebar-primary')} />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </nav>

        {/* Footer: Search + Notifications + User + Collapse */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {/* Search */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openCommandPalette}
                  className="w-full flex items-center justify-center rounded-lg py-2 text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent/20 transition-colors"
                >
                  <Search className="w-4.5 h-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover text-popover-foreground">Buscar (⌘K)</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={openCommandPalette}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent/20 transition-colors"
            >
              <Search className="w-4.5 h-4.5 shrink-0" />
              <span className="flex-1 text-left">Buscar...</span>
              <kbd className="text-xs font-mono bg-sidebar-accent/20 px-1.5 py-0.5 rounded text-sidebar-foreground/40">⌘K</kbd>
            </button>
          )}

          {/* Notifications */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <NotificationBadge onClick={() => setNotifOpen(true)} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover text-popover-foreground">Notificações</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center px-1">
              <NotificationBadge onClick={() => setNotifOpen(true)} />
            </div>
          )}

          {/* User + Collapse */}
          <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            {/* User avatar/dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center justify-center rounded-lg p-1.5 hover:bg-sidebar-accent/20 transition-colors">
                        <Avatar className="h-7 w-7 border border-sidebar-primary/30">
                          <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                            {agentName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground">{agentName}</TooltipContent>
                  </Tooltip>
                ) : (
                  <button className="flex-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/20 transition-colors min-w-0">
                    <Avatar className="h-7 w-7 border border-sidebar-primary/30 shrink-0">
                      <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                        {agentName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-sidebar-foreground/80 truncate">{agentName.split(' ')[0]}</span>
                  </button>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align={collapsed ? 'center' : 'end'} side="top" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{agentName}</p>
                  <p className="text-xs text-muted-foreground truncate">{supaUser?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Collapse toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-primary/20 rounded-lg shrink-0 transition-colors duration-150"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <NotificationCenter open={notifOpen} onOpenChange={setNotifOpen} />
      </aside>
    </TooltipProvider>
  )
}
