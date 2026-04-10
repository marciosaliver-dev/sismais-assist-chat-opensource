import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Search, Link2, UserPlus } from 'lucide-react'
import { useContactSearch } from '@/hooks/useContactSearch'

interface ClientContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (form: { name: string; role: string; phone: string; email: string; is_primary: boolean }) => void
  onLinkExisting?: (contactId: string, role: string, isPrimary: boolean) => void
  isPending: boolean
}

export function ClientContactDialog({ open, onOpenChange, onSave, onLinkExisting, isPending }: ClientContactDialogProps) {
  const [mode, setMode] = useState<'search' | 'new'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '', is_primary: false })

  const { data: searchResults = [] } = useContactSearch(searchQuery)

  function handleSaveNew() {
    if (!form.name.trim()) { toast.error('Nome obrigatorio'); return }
    onSave(form)
    resetForm()
  }

  function handleLink(contact: any) {
    if (onLinkExisting) {
      onLinkExisting(contact.id, form.role, form.is_primary)
    }
    resetForm()
  }

  function resetForm() {
    setForm({ name: '', role: '', phone: '', email: '', is_primary: false })
    setSearchQuery('')
    setMode('search')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar Contato</DialogTitle></DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-2">
          <Button variant={mode === 'search' ? 'default' : 'outline'} size="sm" className="gap-1" onClick={() => setMode('search')}>
            <Search className="w-3.5 h-3.5" /> Buscar existente
          </Button>
          <Button variant={mode === 'new' ? 'default' : 'outline'} size="sm" className="gap-1" onClick={() => setMode('new')}>
            <UserPlus className="w-3.5 h-3.5" /> Criar novo
          </Button>
        </div>

        {mode === 'search' && (
          <div className="space-y-3">
            <div>
              <Label>Buscar por nome, telefone ou email</Label>
              <Input
                placeholder="Digite para buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {searchResults.map((c: any) => (
                  <div key={c.id} className="border rounded-md p-2.5 flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <div className="text-sm">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => handleLink(c)}>
                      <Link2 className="w-3 h-3" /> Vincular
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum contato encontrado. <button className="text-primary underline" onClick={() => setMode('new')}>Criar novo</button>
              </p>
            )}

            {/* Common fields for linking */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cargo / Funcao</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.is_primary} onCheckedChange={v => setForm(f => ({ ...f, is_primary: !!v }))} id="primary-search" />
                  <Label htmlFor="primary-search" className="text-sm">Principal</Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'new' && (
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
            <div><Label>Cargo / Funcao</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_primary} onCheckedChange={v => setForm(f => ({ ...f, is_primary: !!v }))} id="primary-new" />
              <Label htmlFor="primary-new" className="text-sm">Contato principal</Label>
            </div>
          </div>
        )}

        {mode === 'new' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSaveNew} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
