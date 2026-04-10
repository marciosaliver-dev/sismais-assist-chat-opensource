import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { LightboxImage } from './chat-utils'

interface ChatLightboxProps {
  images: LightboxImage[]
  index: number
  onClose: () => void
  onNavigate: (newIndex: number) => void
}

export function ChatLightbox({ images, index, onClose, onNavigate }: ChatLightboxProps) {
  const current = images[index]
  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault() } }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-black/70 backdrop-blur-sm shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {current.senderName?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-tight truncate">{current.senderName}</p>
          {current.time && (
            <p className="text-white/60 text-xs leading-tight">
              {format(new Date(current.time), 'dd/MM/yyyy HH:mm')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {images.length > 1 && (
            <span className="text-white/50 text-xs mr-2">{index + 1} / {images.length}</span>
          )}
          <a
            href={current.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image area with prev/next navigation */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {index > 0 && (
          <button
            className="absolute left-3 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }}
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        <img
          key={current.url}
          src={current.url}
          alt="Imagem ampliada"
          className="max-w-[90vw] max-h-[80vh] object-contain select-none animate-in fade-in duration-100"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {index < images.length - 1 && (
          <button
            className="absolute right-3 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }}
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}
      </div>

      {/* Caption */}
      {current.caption && (
        <div
          className="shrink-0 px-6 py-3 bg-black/70 backdrop-blur-sm text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm">{current.caption}</p>
        </div>
      )}

      {/* Thumbnail strip for multiple images */}
      {images.length > 1 && (
        <div
          className="shrink-0 flex gap-2 px-4 py-3 bg-black/70 backdrop-blur-sm overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => onNavigate(i)}
              className={cn(
                "shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all",
                i === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
              )}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
