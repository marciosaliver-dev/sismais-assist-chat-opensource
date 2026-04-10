import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImagePasteArea } from './ImagePasteArea'
import { useCreateFeedback, uploadFeedbackImage } from '@/hooks/useFeedback'
import type { FeedbackType } from '@/hooks/useFeedback'
import { toast } from 'sonner'
import { Bug, Lightbulb, Sparkles, Loader2 } from 'lucide-react'

interface FeedbackFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const typeOptions: { value: FeedbackType; label: string; icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug / Erro', icon: Bug },
  { value: 'improvement', label: 'Melhoria', icon: Lightbulb },
  { value: 'feature', label: 'Nova Feature', icon: Sparkles },
]

export function FeedbackForm({ open, onOpenChange }: FeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const createFeedback = useCreateFeedback()

  const handleAddImages = useCallback((files: File[]) => {
    setImageFiles(prev => [...prev, ...files])
    const newPreviews = files.map(f => URL.createObjectURL(f))
    setImagePreviews(prev => [...prev, ...newPreviews])
  }, [])

  const handleRemoveImage = useCallback((index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }, [imagePreviews])

  const resetForm = () => {
    setType('bug')
    setTitle('')
    setDescription('')
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setImageFiles([])
    setImagePreviews([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Informe o título da solicitação')
      return
    }

    setSubmitting(true)
    try {
      // Upload das imagens
      const imageUrls: string[] = []
      for (const file of imageFiles) {
        const url = await uploadFeedbackImage(file)
        if (url) imageUrls.push(url)
      }

      await createFeedback.mutateAsync({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        images: imageUrls,
      })

      toast.success('Solicitação enviada com sucesso!')
      resetForm()
      onOpenChange(false)
    } catch (err) {
      console.error('Error creating feedback:', err)
      toast.error('Erro ao enviar solicitação')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descreva brevemente o problema ou ideia"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhe o que aconteceu, como reproduzir ou o que espera..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Imagens</Label>
            <ImagePasteArea
              images={imageFiles}
              previews={imagePreviews}
              onAdd={handleAddImages}
              onRemove={handleRemoveImage}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
