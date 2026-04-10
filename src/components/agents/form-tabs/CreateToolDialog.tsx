import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAgentTools } from '@/hooks/useAgentTools'
import { toast } from '@/components/ui/sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateToolDialog({ open, onOpenChange }: Props) {
  const { createTool } = useAgentTools()
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    description: '',
    function_type: 'api_call' as string,
    endpoint: '',
    method: 'POST' as string,
    parameters_schema: '{}',
    requires_auth: false,
    auth_type: '' as string,
  })

  const handleSave = async () => {
    if (!form.name || !form.description) {
      toast.error('Nome e Descrição são obrigatórios')
      return
    }
    let schema = {}
    try {
      schema = JSON.parse(form.parameters_schema)
    } catch {
      toast.error('Schema de parâmetros inválido (JSON)')
      return
    }
    try {
      await createTool.mutateAsync({
        name: form.name,
        display_name: form.display_name || form.name,
        description: form.description,
        function_type: form.function_type,
        endpoint: form.endpoint || null,
        method: form.method || null,
        parameters_schema: schema,
        requires_auth: form.requires_auth,
        auth_type: form.requires_auth ? form.auth_type || null : null,
        is_active: true,
      })
      toast.success('Ferramenta criada!')
      onOpenChange(false)
      setForm({ name: '', display_name: '', description: '', function_type: 'api_call', endpoint: '', method: 'POST', parameters_schema: '{}', requires_auth: false, auth_type: '' })
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar ferramenta')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ferramenta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="search_knowledge_base" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome de Exibição</Label>
              <Input placeholder="Buscar Base de Conhecimento" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Textarea placeholder="O que esta ferramenta faz..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.function_type} onValueChange={v => setForm(f => ({ ...f, function_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_call">API Call</SelectItem>
                  <SelectItem value="database_query">Database Query</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Método HTTP</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Endpoint</Label>
            <Input placeholder="https://api.example.com/action" value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Schema de Parâmetros (JSON)</Label>
            <Textarea className="font-mono text-xs" rows={4} placeholder='{"type":"object","properties":{}}' value={form.parameters_schema} onChange={e => setForm(f => ({ ...f, parameters_schema: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Requer Autenticação</Label>
            <Switch checked={form.requires_auth} onCheckedChange={v => setForm(f => ({ ...f, requires_auth: v }))} />
          </div>
          {form.requires_auth && (
            <div className="space-y-1.5">
              <Label>Tipo de Auth</Label>
              <Select value={form.auth_type} onValueChange={v => setForm(f => ({ ...f, auth_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={createTool.isPending}>
            {createTool.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
