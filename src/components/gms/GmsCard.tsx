import { cn } from '@/lib/utils'
import type { ReactNode, HTMLAttributes } from 'react'

interface GmsCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  hoverable?: boolean
}

/**
 * Card padrao GMS com sombra navy e hover lift.
 * Conforme design system secao 11: rounded-xl, border, bg-card, shadow navy, hover translateY -1px.
 */
export function GmsCard({ children, className, hoverable = true, ...props }: GmsCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-[#E5E5E5]',
        'shadow-[0_1px_3px_rgba(16,41,63,0.06)]',
        hoverable && 'transition-all duration-200 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-px',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
