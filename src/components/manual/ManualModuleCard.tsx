import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BookOpen,
  Zap,
  Users,
  Settings,
  Shield,
  FileText,
  Kanban,
  GitBranch,
  Smartphone,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BookOpen,
  Zap,
  Users,
  Settings,
  Shield,
  FileText,
  Kanban,
  GitBranch,
  Smartphone,
  dashboard: LayoutDashboard,
  message: MessageSquare,
  chat: MessageSquare,
  bot: Bot,
  book: BookOpen,
  zap: Zap,
  users: Users,
  settings: Settings,
  shield: Shield,
  file: FileText,
  kanban: Kanban,
  git: GitBranch,
  phone: Smartphone,
};

interface ManualModuleCardProps {
  name: string;
  icon?: string | null;
  color?: string | null;
  articleCount: number;
  isActive: boolean;
  onClick: () => void;
}

export function ManualModuleCard({
  name,
  icon,
  color,
  articleCount,
  isActive,
  onClick,
}: ManualModuleCardProps) {
  const iconKey = icon ?? '';
  const IconComponent: LucideIcon = ICON_MAP[iconKey] ?? BookOpen;
  const accentColor = color ?? '#45E5E5';

  function hexAlpha(hex: string, alpha: number) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer group',
        isActive
          ? 'border-l-[3px] border-l-[#45E5E5] bg-[#E8F9F9] shadow-[0_4px_14px_rgba(69,229,229,0.2)]'
          : 'border-[#E5E5E5] bg-white hover:shadow-[0_4px_6px_-1px_rgba(16,41,63,0.1)] hover:-translate-y-0.5'
      )}
      style={{
        borderTopWidth: '3px',
        borderTopColor: accentColor,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon square */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 52,
            height: 52,
            backgroundColor: hexAlpha(accentColor, 0.15),
          }}
        >
          <IconComponent size={24} style={{ color: accentColor }} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[#10293F] truncate">
            {name}
          </p>
          <span
            className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: hexAlpha(accentColor, 0.12),
              color: '#10293F',
            }}
          >
            {articleCount} {articleCount === 1 ? 'artigo' : 'artigos'}
          </span>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={16}
          className={cn(
            'flex-shrink-0 mt-1 transition-all duration-200',
            isActive ? 'text-[#10293F] opacity-100' : 'text-[#CCC] opacity-0 group-hover:opacity-100'
          )}
        />
      </div>
    </button>
  );
}
