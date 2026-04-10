import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Activity } from 'lucide-react'
import { PRODUCT_OPTIONS, SISTEMA_OPTIONS } from './constants'
import type { ExtendedClient, ClientForm } from './types'

// Mascaras de formatacao
function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

interface ClientEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ExtendedClient | null
  onSave: (form: ClientForm) => void
  isPending: boolean
}

export function ClientEditDialog({ open, onOpenChange, client, onSave, isPending }: ClientEditDialogProps) {
  const [form, setForm] = useState<ClientForm>({
    name: '', company_name: '', cnpj: '', cpf: '', email: '', phone: '',
    subscribed_product: 'outro', subscribed_product_custom: '', notes: '', sistema: '',
  })

  useEffect(() => {
    if (client && open) {
      setForm({
        name: client.name || '', company_name: client.company_name || '',
        cnpj: client.cnpj || '', cpf: client.cpf || '',
        email: client.email || '', phone: client.phone || '',
        subscribed_product: client.subscribed_product || 'outro',
        subscribed_product_custom: client.subscribed_product_custom || '',
        notes: client.notes || '', sistema: client.sistema || '',
      })
    }
  }, [client, open])

  function handleSave() {
    if (!form.name.trim()) { toast.error('Nome obrigatorio'); return }
    onSave(form)
  }

  const glStatusBadge = (label: string, status: string | null | undefined) => {
    if (!status) return null
    const isActive = status === 'Ativo' || status === 'Trial 7 Dias'
    return (
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <Badge className={`text-[11px] font-bold border gap-1 px-2 py-0.5 ${
          isActive ? 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]'
          : status === 'Bloqueado' ? 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]'
          : 'bg-[#FFFBEB] text-[#10293F] border-[rgba(255,184,0,0.5)]'
        }`}>
          {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {status}
        </Badge>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Status GL (readonly) */}
          {(client?.gl_status_mais_simples || client?.gl_status_maxpro) && (
            <div className="bg-secondary rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Activity className="w-3.5 h-3.5" /> Status GL (somente leitura)
              </div>
              {glStatusBadge('Mais Simples', client.gl_status_mais_simples)}
              {glStatusBadge('Maxpro', client.gl_status_maxpro)}
            </div>
          )}

          <div><Label>Nome completo *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Empresa</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} placeholder="00.000.000/0000-00" onChange={e => setForm(f => ({ ...f, cnpj: maskCNPJ(e.target.value) }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CPF</Label><Input value={form.cpf} placeholder="000.000.000-00" onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} placeholder="(00) 00000-0000" onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} /></div>
          </div>
          <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Produto Assinante</Label>
              <Select value={form.subscribed_product} onValueChange={v => setForm(f => ({ ...f, subscribed_product: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCT_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sistema Principal</Label>
              <Select value={form.sistema || '_nenhum'} onValueChange={v => setForm(f => ({ ...f, sistema: v === '_nenhum' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_nenhum">Nao informado</SelectItem>
                  {SISTEMA_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.subscribed_product === 'outro' && (
            <div><Label>Qual produto?</Label><Input value={form.subscribed_product_custom} onChange={e => setForm(f => ({ ...f, subscribed_product_custom: e.target.value }))} /></div>
          )}
          <div><Label>Anotacoes gerais</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
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
