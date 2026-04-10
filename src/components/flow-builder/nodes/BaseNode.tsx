import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Badge } from '@/components/ui/badge'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BaseNodeProps extends NodeProps {
  icon: LucideIcon
  color: string
  title: string
  description?: string
  badge?: string
  showSourceHandle?: boolean
  showTargetHandle?: boolean
  multipleSourceHandles?: Array<{ id: string; label: string; color?: string }>
}

export const BaseNode = memo(({
  icon: Icon,
  color,
  title,
  description,
  badge,
  selected,
  showSourceHandle = true,
  showTargetHandle = true,
  multipleSourceHandles,
}: BaseNodeProps) => {
  return (
    <div
      className={cn(
        'rounded-xl border-2 bg-card shadow-lg min-w-[220px] max-w-[280px] transition-all duration-200',
        selected ? 'ring-2 ring-primary shadow-xl scale-[1.02]' : 'hover:shadow-xl'
      )}
      style={{ borderColor: `${color}80` }}
    >
      {/* Target Handle */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-background"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-t-[10px]"
        style={{ background: `linear-gradient(135deg, ${color}20, ${color}10)` }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-bold uppercase tracking-wide truncate" style={{ color }}>
            {title}
          </span>
          {badge && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 shrink-0">
              {badge}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      {description && (
        <div className="px-3 py-2 border-t" style={{ borderColor: `${color}20` }}>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      )}

      {/* Source Handle */}
      {showSourceHandle && !multipleSourceHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-background"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Multiple Source Handles */}
      {multipleSourceHandles && (
        <div className="flex justify-around px-2 pb-2 pt-1">
          {multipleSourceHandles.map((handle, idx) => (
            <div key={handle.id} className="relative flex flex-col items-center">
              <span
                className="text-xs font-semibold mb-1"
                style={{ color: handle.color || color }}
              >
                {handle.label}
              </span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={handle.id}
                className="!relative !transform-none !w-3 !h-3 !border-2 !border-background"
                style={{ backgroundColor: handle.color || color }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

BaseNode.displayName = 'BaseNode'
