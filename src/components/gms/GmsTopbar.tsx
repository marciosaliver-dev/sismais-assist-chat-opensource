import { useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'


// Mapa de rotas para breadcrumb
const routeMap: Record<string, { section: string; page: string }> = {
  '/': { section: 'Atendimento', page: 'Dashboard' },
  '/dashboard': { section: 'Atendimento', page: 'Dashboard' },
  '/agents': { section: 'IA', page: 'Agentes IA' },
  '/supervisor': { section: 'IA', page: 'Supervisao' },
  '/ai-config': { section: 'IA', page: 'Configuracao IA' },
  '/ai-configurator': { section: 'IA', page: 'Configurador IA' },
  '/automations': { section: 'IA', page: 'Automacoes' },
  '/campaigns': { section: 'IA', page: 'Campanhas' },
  '/macros': { section: 'IA', page: 'Macros' },
  '/skills': { section: 'IA', page: 'Skills' },
  '/whatsapp-instances': { section: 'Canais', page: 'WhatsApp' },
  '/clients': { section: 'Clientes', page: 'Clientes' },
  '/contacts': { section: 'Clientes', page: 'Contatos' },
  '/knowledge': { section: 'Conhecimento', page: 'Base de Conhecimento' },
  '/service-catalog': { section: 'Conhecimento', page: 'Servicos' },
  '/ai-consumption': { section: 'Config', page: 'Consumo IA' },
  '/ai-settings': { section: 'Config', page: 'Config. IA' },
  '/settings': { section: 'Config', page: 'Configuracoes' },
  '/evaluations': { section: 'Atendimento', page: 'Avaliacoes' },
  '/feriados': { section: 'Config', page: 'Feriados' },
  '/docs': { section: 'Config', page: 'Documentacao' },
  '/admin/users': { section: 'Admin', page: 'Equipe & Acessos' },
  '/admin/permissions': { section: 'Admin', page: 'Permissoes' },
  '/admin/integrations': { section: 'Admin', page: 'Integracoes' },
  '/admin/api-keys': { section: 'Admin', page: 'API Parceiros' },
  '/reports/tickets': { section: 'Relatorios', page: 'Tickets' },
  '/reports/company-volume': { section: 'Relatorios', page: 'Volume por Empresa' },
  '/reports/executive': { section: 'Relatorios', page: 'Dashboard Executivo' },
  '/help': { section: 'Config', page: 'Central de Ajuda' },
  '/inbox': { section: 'Atendimento', page: 'Inbox' },
}

function useBreadcrumb() {
  const { pathname } = useLocation()

  if (pathname.startsWith('/kanban/')) {
    const slug = pathname.split('/kanban/')[1]
    return { section: 'Atendimento', page: `Kanban — ${slug}` }
  }
  if (pathname.match(/^\/clients\/[^/]+$/)) {
    return { section: 'Clientes', page: 'Detalhe do Cliente' }
  }
  if (pathname.startsWith('/agents/playground/')) {
    return { section: 'IA', page: 'Playground' }
  }

  return routeMap[pathname] ||
    Object.entries(routeMap).find(([key]) => key !== '/' && pathname.startsWith(key))?.[1] ||
    { section: 'Sistema', page: pathname.slice(1) || 'Pagina' }
}

export function GmsTopbar() {
  const breadcrumb = useBreadcrumb()

  return (
    <header
      className="h-[44px] flex items-center px-5 gap-3 shrink-0 sticky top-0 z-50"
      style={{
        background: '#10293F',
        boxShadow: '0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 flex-1 text-[13px]" aria-label="Breadcrumb">
        <span className="text-white/50">{breadcrumb.section}</span>
        <ChevronRight className="w-3 h-3 text-white/25" />
        <span className="text-white font-medium">{breadcrumb.page}</span>
      </nav>
    </header>
  )
}
