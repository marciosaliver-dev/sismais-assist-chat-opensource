import { LayoutDashboard, KanbanSquare, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: KanbanSquare, label: 'Task Board' },
  { to: '/approvals', icon: CheckCircle, label: 'Approvals' },
  { to: '/timeline', icon: Clock, label: 'Timeline' },
]

export function Sidebar() {
  return (
    <aside className="w-56 bg-navy flex flex-col border-r border-surface-border shrink-0">
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="bg-cyan text-navy text-xs font-bold px-1.5 py-0.5 rounded">GMS</span>
          <span className="text-sm font-medium text-white/90">DevOps</span>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-cyan/10 text-cyan font-medium'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-surface-border text-xs text-white/30">
        26 agents registered
      </div>
    </aside>
  )
}
