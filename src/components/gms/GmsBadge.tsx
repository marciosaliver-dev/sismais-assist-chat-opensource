import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type GmsBadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral' | 'navy' | 'cyan' | 'yellow'

const variantStyles: Record<GmsBadgeVariant, string> = {
  info:    'bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)]',
  success: 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]',
  warning: 'bg-[#FFFBEB] text-[#92400E] border-[rgba(255,184,0,0.5)]',
  error:   'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]',
  neutral: 'bg-[#F5F5F5] text-[#444444] border-[#E5E5E5]',
  navy:    'bg-[#10293F] text-white border-[#10293F]',
  cyan:    'bg-[#45E5E5] text-[#10293F] border-[#45E5E5]',
  yellow:  'bg-[#FFB800] text-[#10293F] border-[#FFB800]',
}

interface GmsBadgeProps {
  variant?: GmsBadgeVariant
  children: ReactNode
  className?: string
  size?: 'sm' | 'md'
}

export function GmsBadge({ variant = 'neutral', children, className, size = 'md' }: GmsBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0 text-[10px] leading-[18px]' : 'px-2 py-0.5 text-[11px] leading-[1.4]',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
