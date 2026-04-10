import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ClientContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (form: { contract_number: string; plan_name: string; status: string; start_date: string; end_date: string; value: string; notes: string }) => void
  isPending: boolean
}

export function ClientContractDialog({ open, onOpenChange, onSave, isPending }: ClientContractDialogProps) {
  const [form, setForm] = useState({
    contract_number: '', plan_name: '', status: 'active',
    start_date: '', end_date: '', value: '', notes: '',
  })

  function handleSave() {
    onSave(form)
    setForm({ contract_number: '', plan_name: '', status: 'active', start_date: '', end_date: '', value: '', notes: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Numero do Contrato</Label><Input value={form.contract_number} onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))} /></div>
          <div><Label>Nome do Plano</Label><Input value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data de Inicio</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div><Label>Data de Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          <div><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
          <div><Label>Observacoes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
