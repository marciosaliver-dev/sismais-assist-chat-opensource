import { useCallback, useRef } from 'react'
import { X, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImagePasteAreaProps {
  images: File[]
  previews: string[]
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
  className?: string
}

export function ImagePasteArea({ images, previews, onAdd, onRemove, className }: ImagePasteAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) onAdd(imageFiles)
  }, [onAdd])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) onAdd(files)
    e.target.value = ''
  }, [onAdd])

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onPaste={handlePaste}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-[#45E5E5] hover:bg-[#45E5E5]/5 transition-colors"
        role="button"
        tabIndex={0}
        aria-label="Colar ou selecionar imagens"
      >
        <ImagePlus className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Cole uma imagem com <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+V</kbd> ou clique para selecionar
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Imagem ${index + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(index) }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remover imagem ${index + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
