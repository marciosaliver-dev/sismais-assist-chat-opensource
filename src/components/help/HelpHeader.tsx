import { Link, useLocation } from 'react-router-dom'
import { Home, BookOpen, PlayCircle, Ticket, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Início', path: '/help-center', icon: Home },
  { label: 'Manuais', path: '/help/manuals', icon: BookOpen },
  { label: 'Vídeos', path: '/help/videos', icon: PlayCircle },
  { label: 'Meus Chamados', path: '/help/tickets', icon: Ticket },
]

export function HelpHeader() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-40 h-[52px] bg-gms-navy flex items-center px-5 gap-4 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      <Link to="/help-center" className="flex items-center gap-2 shrink-0">
        <span className="bg-gms-cyan text-gms-navy font-poppins font-bold text-[13px] px-[7px] py-[3px] rounded tracking-[0.5px]">
          GMS
        </span>
        <span className="w-px h-5 bg-white/20" />
        <span className="text-white font-poppins text-[13px] font-medium opacity-90">
          Central de Ajuda
        </span>
      </Link>

      <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon
          const isActive =
            link.path === '/help-center'
              ? pathname === '/help-center'
              : pathname.startsWith(link.path)
          return (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-[rgba(69,229,229,0.15)] text-gms-cyan'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
        <button
          aria-label="Notificações"
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-150"
        >
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors duration-150 cursor-pointer">
          <span className="w-7 h-7 rounded-full bg-gms-cyan text-gms-navy text-[11px] font-bold flex items-center justify-center">
            MS
          </span>
          <span className="hidden sm:inline text-white/85 text-[13px]">Marcio S.</span>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gms-navy border-t border-white/10 flex">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon
          const isActive =
            link.path === '/help-center'
              ? pathname === '/help-center'
              : pathname.startsWith(link.path)
          return (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-gms-cyan' : 'text-white/60'
              )}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
