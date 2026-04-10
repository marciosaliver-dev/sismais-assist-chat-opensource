import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Package } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import type { KnowledgeProduct } from '@/hooks/useKnowledgeProducts'

interface ProductManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: KnowledgeProduct[]
  onEdit: (product: KnowledgeProduct) => void
  onDelete: (id: string) => Promise<void>
  loading?: boolean
}

export function ProductManagerDialog({
  open,
  onOpenChange,
  products,
  onEdit,
  onDelete,
  loading,
}: ProductManagerDialogProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deleteId) return
    await onDelete(deleteId)
    setDeleteId(null)
    toast.success('Produto removido!')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Gerenciar Produtos</DialogTitle>
            <DialogDescription>
              Gerencie os produtos da base de conhecimento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 mt-2">
            {products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: product.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onEdit(product)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => setDeleteId(product.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir produto"
        description="Os documentos e grupos deste produto serão mantidos, mas ficarão sem produto. Deseja continuar?"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        loading={loading}
      />
    </>
  )
}
