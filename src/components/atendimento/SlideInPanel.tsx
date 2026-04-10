import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  width?: number
  children: React.ReactNode
}

export function SlideInPanel({ isOpen, onClose, width = 820, children }: Props) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-[var(--gms-navy)]/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do atendimento"
        className={cn(
          'fixed top-0 right-0 h-full z-[310] bg-white border-l border-[var(--gms-g200)]',
          'shadow-[var(--gms-sh-lg)]',
          'animate-in slide-in-from-right duration-300',
        )}
        style={{ width: `${width}px`, maxWidth: '95vw' }}
      >
        {/* Back button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 p-1.5 rounded-lg bg-[var(--gms-g100)] text-[var(--gms-g700)] hover:bg-[var(--gms-g200)] transition-colors"
          aria-label="Fechar painel"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="h-full overflow-hidden">
          {children}
        </div>
      </div>
    </>
  )
}
