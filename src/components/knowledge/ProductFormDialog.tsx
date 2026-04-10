import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { KnowledgeProduct, KnowledgeProductInsert } from '@/hooks/useKnowledgeProducts'

const COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: KnowledgeProduct | null
  onSave: (data: KnowledgeProductInsert) => Promise<void>
  loading?: boolean
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSave,
  loading,
}: ProductFormDialogProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [autoSlug, setAutoSlug] = useState(true)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setSlug(product.slug)
      setDescription(product.description || '')
      setColor(product.color || COLORS[0])
      setAutoSlug(false)
    } else {
      setName('')
      setSlug('')
      setDescription('')
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)])
      setAutoSlug(true)
    }
  }, [product, open])

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const handleNameChange = (value: string) => {
    setName(value)
    if (autoSlug) {
      setSlug(generateSlug(value))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do produto')
      return
    }
    if (!slug.trim()) {
      toast.error('Informe o slug do produto')
      return
    }
    await onSave({ name: name.trim(), slug: slug.trim(), description: description.trim() || null, color })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            {product
              ? 'Edite as informações do produto'
              : 'Crie um novo produto para organizar a base de conhecimento'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-foreground">Nome</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: MaxPro"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Slug (identificador URL)</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setAutoSlug(false)
              }}
              placeholder="ex: maxpro"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição breve do produto..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? 'Salvando...' : product ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
