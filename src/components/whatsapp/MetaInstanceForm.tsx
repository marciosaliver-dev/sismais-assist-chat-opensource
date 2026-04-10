import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'

interface MetaInstanceFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingInstance?: {
    id: string
    display_name: string
    phone_number: string
    config: Record<string, unknown>
    kanban_board_id?: string | null
  } | null
  onSave: (data: {
    id?: string
    channel_type: string
    display_name: string
    phone_number: string
    is_active: boolean
    status: string
    config: Record<string, unknown>
    kanban_board_id?: string | null
  }) => void
  isSaving: boolean
}

export function MetaInstanceForm({ open, onOpenChange, editingInstance, onSave, isSaving }: MetaInstanceFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [graphVersion, setGraphVersion] = useState('v21.0')
  const [boardId, setBoardId] = useState<string>('')

  const { data: boards = [] } = useKanbanBoards()

  useEffect(() => {
    if (editingInstance) {
      setDisplayName(editingInstance.display_name || '')
      setPhoneNumber(editingInstance.phone_number || '')
      setPhoneNumberId(String(editingInstance.config?.phone_number_id || ''))
      setWabaId(String(editingInstance.config?.waba_id || ''))
      setAccessToken(String(editingInstance.config?.access_token || ''))
      setVerifyToken(String(editingInstance.config?.webhook_verify_token || ''))
      setGraphVersion(String(editingInstance.config?.graph_api_version || 'v21.0'))
      setBoardId(editingInstance.kanban_board_id || '')
    } else {
      setDisplayName('')
      setPhoneNumber('')
      setPhoneNumberId('')
      setWabaId('')
      setAccessToken('')
      setVerifyToken('sismais_meta_verify_' + new Date().getFullYear())
      setGraphVersion('v21.0')
      setBoardId('')
    }
  }, [editingInstance, open])

  const handleSubmit = () => {
    if (!displayName.trim() || !phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) return
    onSave({
      ...(editingInstance ? { id: editingInstance.id } : {}),
      channel_type: 'meta_whatsapp',
      display_name: displayName.trim(),
      phone_number: phoneNumber.trim(),
      is_active: true,
      status: 'pending_setup',
      config: {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim(),
        access_token: accessToken.trim(),
        webhook_verify_token: verifyToken.trim(),
        graph_api_version: graphVersion,
        display_name: displayName.trim(),
      },
      kanban_board_id: boardId && boardId !== 'none' ? boardId : null,
    })
  }

  const isValid = displayName.trim() && phoneNumberId.trim() && wabaId.trim() && accessToken.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingInstance ? 'Editar Instância Meta' : 'Nova Instância Meta WhatsApp'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="meta-display-name">Display Name *</Label>
            <Input id="meta-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex: Suporte Sismais" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-phone">Número de Telefone</Label>
            <Input id="meta-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+5577999991234" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-phone-id">Phone Number ID *</Label>
            <Input id="meta-phone-id" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Da Meta Developer Console" className="font-mono text-sm" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-waba-id">WABA ID *</Label>
            <Input id="meta-waba-id" value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WhatsApp Business Account ID" className="font-mono text-sm" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-token">Access Token *</Label>
            <Input id="meta-token" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Token do System User (permanente)" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-verify">Webhook Verify Token</Label>
            <Input id="meta-verify" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="Token de verificação do webhook" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Graph API Version</Label>
              <Select value={graphVersion} onValueChange={setGraphVersion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="v21.0">v21.0</SelectItem>
                  <SelectItem value="v20.0">v20.0</SelectItem>
                  <SelectItem value="v19.0">v19.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kanban Board</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {boards.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingInstance ? 'Salvar' : 'Criar Instância'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
