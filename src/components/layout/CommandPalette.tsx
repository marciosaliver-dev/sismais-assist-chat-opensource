import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  MessageSquare,
  Columns,
  Bot,
  Headphones,
  Sparkles,
  Zap,
  Smartphone,
  Users2,
  Contact,
  BookOpen,
  BarChart3,
  Settings,
  Settings2,
  FileText,
  ShieldCheck,
  Plug,
  Plus,
  Ticket,
  Search,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'

const PAGES = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: 'dashboard inicio home', group: 'Atendimento' },
  
  { label: 'Kanban', path: '/kanban/support', icon: Columns, keywords: 'kanban board quadro', group: 'Atendimento' },
  { label: 'Agentes IA', path: '/agents', icon: Bot, keywords: 'agentes ia inteligencia artificial', group: 'Inteligência' },
  { label: 'Agentes Humanos', path: '/human-agents', icon: Headphones, keywords: 'agentes humanos atendentes', group: 'Inteligência' },
  { label: 'Configurador IA', path: '/ai-configurator', icon: Sparkles, keywords: 'configurador assistente ia', group: 'Inteligência' },
  { label: 'Automações', path: '/automations', icon: Zap, keywords: 'automacoes fluxos triggers', group: 'Inteligência' },
  { label: 'Macros', path: '/macros', icon: FileText, keywords: 'macros respostas rapidas templates', group: 'Inteligência' },
  { label: 'WhatsApp', path: '/whatsapp-instances', icon: Smartphone, keywords: 'whatsapp instancias uazapi', group: 'Canais & Dados' },
  { label: 'Clientes', path: '/clients', icon: Users2, keywords: 'clientes helpdesk', group: 'Canais & Dados' },
  { label: 'Contatos', path: '/contacts', icon: Contact, keywords: 'contatos telefone whatsapp', group: 'Canais & Dados' },
  { label: 'Base de Conhecimento', path: '/knowledge', icon: BookOpen, keywords: 'conhecimento knowledge rag documentos', group: 'Canais & Dados' },
  { label: 'Consumo IA', path: '/ai-consumption', icon: BarChart3, keywords: 'consumo tokens custo ia', group: 'Canais & Dados' },
  { label: 'Configurações', path: '/settings', icon: Settings, keywords: 'configuracoes settings sistema', group: 'Configuração' },
  { label: 'Config. IA', path: '/ai-settings', icon: Settings2, keywords: 'configuracoes ia settings modelos', group: 'Configuração' },
  { label: 'Documentação', path: '/docs', icon: FileText, keywords: 'documentacao docs', group: 'Configuração' },
  { label: 'Permissões', path: '/admin/permissions', icon: ShieldCheck, keywords: 'permissoes admin', group: 'Admin' },
  { label: 'Integrações', path: '/admin/integrations', icon: Plug, keywords: 'integracoes admin', group: 'Admin' },
]

const ACTIONS = [
  { label: 'Nova automação', path: '/automations/new', icon: Plus, keywords: 'criar nova automacao' },
  { label: 'Adicionar documento', path: '/knowledge', icon: Plus, keywords: 'adicionar documento knowledge' },
  { label: 'Nova instância WhatsApp', path: '/whatsapp-instances', icon: Plus, keywords: 'criar nova instancia whatsapp' },
  { label: 'Novo Agente IA', path: '/agents', icon: Plus, keywords: 'criar novo agente' },
]

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function getPriorityBadge(priority: string | null) {
  switch (priority) {
    case 'high': return { label: 'Alta', cls: 'bg-destructive/10 text-destructive' }
    case 'critical': return { label: 'Crítica', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
    case 'low': return { label: 'Baixa', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
    default: return { label: 'Média', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const debouncedSearch = useDebouncedValue(search, 300)
  const hasSearch = debouncedSearch.trim().length >= 2

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  // Search tickets
  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ['cmd-tickets', debouncedSearch],
    queryFn: async () => {
      const term = debouncedSearch.trim()
      // Check if searching by ticket number
      const ticketNum = parseInt(term)
      let query = supabase
        .from('ai_conversations')
        .select('id, ticket_number, customer_name, customer_phone, status, priority, ticket_subject')
        .order('ticket_number', { ascending: false })
        .limit(6)

      if (!isNaN(ticketNum) && term.replace('#', '') === String(ticketNum)) {
        query = query.eq('ticket_number', ticketNum)
      } else {
        query = query.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,ticket_subject.ilike.%${term}%`)
      }

      const { data } = await query
      return data || []
    },
    enabled: hasSearch && open,
    staleTime: 10_000,
  })

  // Search contacts (helpdesk_clients)
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['cmd-contacts', debouncedSearch],
    queryFn: async () => {
      const term = debouncedSearch.trim()
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('id, name, company_name, phone, email')
        .or(`name.ilike.%${term}%,company_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
        .order('name')
        .limit(6)
      return data || []
    },
    enabled: hasSearch && open,
    staleTime: 10_000,
  })

  const isSearching = hasSearch && (loadingTickets || loadingContacts)

  const handleSelect = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  // Group pages by group
  const groups = useMemo(() =>
    PAGES.reduce<Record<string, typeof PAGES>>((acc, page) => {
      if (!acc[page.group]) acc[page.group] = []
      acc[page.group].push(page)
      return acc
    }, {}), []
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar tickets, contatos, páginas... ⌘K"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Buscando...</span>
            </div>
          ) : (
            'Nenhum resultado encontrado.'
          )}
        </CommandEmpty>

        {/* Live ticket results */}
        {hasSearch && tickets && tickets.length > 0 && (
          <>
            <CommandGroup heading="Tickets">
              {tickets.map((t) => {
                const badge = getPriorityBadge(t.priority)
                return (
                  <CommandItem
                    key={t.id}
                    value={`ticket #${t.ticket_number} ${t.customer_name || ''} ${t.ticket_subject || ''}`}
                    onSelect={() => handleSelect(`/kanban/support?ticket=${t.ticket_number}`)}
                    className="gap-2.5"
                  >
                    <Ticket className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{t.ticket_number}</span>
                        <span className="truncate text-sm">{t.customer_name || t.customer_phone}</span>
                      </div>
                      {t.ticket_subject && (
                        <span className="text-xs text-muted-foreground truncate">{t.ticket_subject}</span>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Live contact results */}
        {hasSearch && contacts && contacts.length > 0 && (
          <>
            <CommandGroup heading="Contatos">
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contato ${c.name} ${c.company_name || ''} ${c.phone || ''} ${c.email || ''}`}
                  onSelect={() => handleSelect(`/clients/${c.id}`)}
                  className="gap-2.5"
                >
                  <Users2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[c.company_name, c.phone, c.email].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick actions */}
        <CommandGroup heading="Ações Rápidas">
          {ACTIONS.map((action, i) => (
            <CommandItem
              key={`action-${i}`}
              value={`${action.label} ${action.keywords}`}
              onSelect={() => handleSelect(action.path)}
              className="gap-2.5"
            >
              <action.icon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Pages */}
        {Object.entries(groups).map(([groupName, items]) => (
          <CommandGroup key={groupName} heading={groupName}>
            {items.map((page) => (
              <CommandItem
                key={page.path}
                value={`${page.label} ${page.keywords}`}
                onSelect={() => handleSelect(page.path)}
                className="gap-2.5"
              >
                <page.icon className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1">{page.label}</span>
                {page.path === '/' && <CommandShortcut>⌘K</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
