import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, GripVertical, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { KnowledgeGroup } from '@/hooks/useKnowledgeGroups'
import type { KnowledgeProduct } from '@/hooks/useKnowledgeProducts'

interface GroupManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: KnowledgeProduct | null
  groups: KnowledgeGroup[]
  onCreateGroup: (data: { product_id: string; name: string; description?: string }) => Promise<void>
  onUpdateGroup: (id: string, data: { name?: string; description?: string }) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  loading?: boolean
}

export function GroupManagerDialog({
  open,
  onOpenChange,
  product,
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  loading,
}: GroupManagerDialogProps) {
  const [newGroupName, setNewGroupName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  if (!product) return null

  const handleCreate = async () => {
    if (!newGroupName.trim()) {
      toast.error('Informe o nome do grupo')
      return
    }
    await onCreateGroup({
      product_id: product.id,
      name: newGroupName.trim(),
    })
    setNewGroupName('')
    toast.success('Grupo criado!')
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    await onUpdateGroup(id, { name: editName.trim() })
    setEditingId(null)
    toast.success('Grupo atualizado!')
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await onDeleteGroup(deleteId)
    setDeleteId(null)
    toast.success('Grupo removido!')
  }

  const startEdit = (group: KnowledgeGroup) => {
    setEditingId(group.id)
    setEditName(group.name)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-card border-border max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: product.color || '#6366f1' }}
              />
              Grupos de {product.name}
            </DialogTitle>
            <DialogDescription>
              Organize os documentos deste produto em grupos temáticos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Add new group */}
            <div className="flex gap-2">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Nome do novo grupo..."
                className="flex-1"
              />
              <Button
                onClick={handleCreate}
                disabled={loading || !newGroupName.trim()}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Group list */}
            <div className="space-y-1">
              {groups.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum grupo criado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adicione grupos para organizar os documentos
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                    <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />

                    {editingId === group.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(group.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => handleUpdate(group.id)}
                        autoFocus
                        className="h-7 text-sm flex-1"
                      />
                    ) : (
                      <span className="text-sm text-foreground flex-1 truncate">
                        {group.name}
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => startEdit(group)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => setDeleteId(group.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir grupo"
        description="Os documentos deste grupo serão mantidos, mas ficarão sem grupo. Deseja continuar?"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        loading={loading}
      />
    </>
  )
}
