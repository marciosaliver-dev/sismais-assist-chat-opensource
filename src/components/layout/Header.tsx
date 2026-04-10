import { useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronRight, Search, Settings, LogOut } from 'lucide-react'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

const routeMap: Record<string, { section: string; page: string }> = {
  '/': { section: 'Atendimento', page: 'Dashboard' },
  '/dashboard': { section: 'Atendimento', page: 'Dashboard' },
  
  '/agents': { section: 'Inteligência', page: 'Agentes IA' },
  '/human-agents': { section: 'Inteligência', page: 'Agentes Humanos' },
  '/ai-configurator': { section: 'Inteligência', page: 'Configurador IA' },
  '/automations': { section: 'Inteligência', page: 'Automações' },
  '/macros': { section: 'Inteligência', page: 'Macros' },
  '/whatsapp-instances': { section: 'Canais & Dados', page: 'WhatsApp' },
  '/clients': { section: 'Canais & Dados', page: 'Clientes' },
  '/contacts': { section: 'Canais & Dados', page: 'Contatos' },
  '/knowledge': { section: 'Canais & Dados', page: 'Conhecimento' },
  '/ai-consumption': { section: 'Canais & Dados', page: 'Consumo IA' },
  '/settings': { section: 'Configuração', page: 'Configurações' },
  '/ai-settings': { section: 'Configuração', page: 'Config. IA' },
  '/docs': { section: 'Configuração', page: 'Documentação' },
  '/admin/users': { section: 'Admin', page: 'Usuários' },
  '/admin/permissions': { section: 'Admin', page: 'Permissões' },
  '/admin/integrations': { section: 'Admin', page: 'Integrações' },
}

const sectionFirstRoute: Record<string, string> = {
  'Atendimento': '/',
  'Inteligência': '/agents',
  'Canais & Dados': '/whatsapp-instances',
  'Configuração': '/settings',
  'Admin': '/admin/users',
}

function useBreadcrumb() {
  const { pathname } = useLocation()
  return routeMap[pathname] ||
    Object.entries(routeMap).find(([key]) => key !== '/' && pathname.startsWith(key))?.[1] ||
    { section: 'Sistema', page: pathname.slice(1) || 'Página' }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function openCommandPalette() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}

export function Header() {
  const { user, signOut } = useSupabaseAuth()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const breadcrumb = useBreadcrumb()

  const agentName = user?.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Agente'

  return (
    <header className="h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-6 shrink-0" style={{ boxShadow: '0 1px 4px 0 hsl(var(--foreground) / 0.04)' }}>
      {/* Left: Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <Link to={sectionFirstRoute[breadcrumb.section] || '/'} className="text-muted-foreground/70 text-sm font-medium hover:text-foreground transition-colors">
          {breadcrumb.section}
        </Link>
        <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
        <span className="font-semibold text-foreground text-sm">{breadcrumb.page}</span>
      </nav>

      {/* Right: Search + Notifications + Avatar */}
      <div className="flex items-center gap-2">
        {/* Global Search Button */}
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-muted-foreground font-normal h-9 px-3 w-56 justify-start rounded-lg border-border/60 bg-muted/50 hover:bg-muted transition-colors"
          onClick={openCommandPalette}
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Buscar...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        <NotificationBadge onClick={() => setNotifOpen(true)} />

        {/* Avatar with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {getGreeting()}, {agentName.split(' ')[0]}
              </span>
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {agentName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{agentName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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
      </div>

      <NotificationCenter open={notifOpen} onOpenChange={setNotifOpen} />
    </header>
  )
}
