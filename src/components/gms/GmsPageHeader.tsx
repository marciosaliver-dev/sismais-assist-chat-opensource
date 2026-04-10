import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface GmsPageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
  className?: string
}

/**
 * Header padrao de pagina GMS com titulo Poppins em navy,
 * linha accent cyan e area para acoes a direita.
 */
export function GmsPageHeader({ title, subtitle, children, className }: GmsPageHeaderProps) {
  return (
    <div
      className={cn(
        'pb-5 mb-6 border-b border-[#E5E5E5] relative flex items-center justify-between gap-4',
        className,
      )}
    >
      {/* Accent line cyan */}
      <div className="absolute bottom-[-1px] left-0 w-12 h-0.5 rounded bg-[#45E5E5]" />

      <div>
        <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-display">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[#666666] mt-0.5">{subtitle}</p>
        )}
      </div>

      {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  )
}
