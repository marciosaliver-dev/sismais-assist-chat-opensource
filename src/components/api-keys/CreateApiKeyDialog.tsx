import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useCreateApiKey } from "@/hooks/useApiKeys"

const AVAILABLE_SCOPES = [
  { value: "conversations:read", label: "Conversas (leitura)" },
  { value: "tickets:read", label: "Tickets (leitura)" },
  { value: "clients:read", label: "Clientes (leitura)" },
  { value: "webhooks:read", label: "Webhooks (leitura)" },
  { value: "webhooks:write", label: "Webhooks (escrita)" },
]

const DEFAULT_SCOPES = ["conversations:read", "tickets:read", "clients:read"]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onKeyCreated: (keyData: { key: string; name: string }) => void
}

export function CreateApiKeyDialog({ open, onOpenChange, onKeyCreated }: Props) {
  const [name, setName] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [plan, setPlan] = useState("free")
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES)
  const [expiresAt, setExpiresAt] = useState("")

  const createMutation = useCreateApiKey()

  function toggleScope(scope: string) {
    setScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    )
  }

  function reset() {
    setName("")
    setOrganizationName("")
    setContactEmail("")
    setPlan("free")
    setScopes(DEFAULT_SCOPES)
    setExpiresAt("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await createMutation.mutateAsync({
      name,
      organization_name: organizationName,
      contact_email: contactEmail,
      plan,
      scopes,
      expires_at: expiresAt || null,
    })
    onKeyCreated({ key: result.key, name: result.name })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova API Key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da chave *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: ERP Parceiro X" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org">Organizacao *</Label>
            <Input id="org" value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="Nome da empresa parceira" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email de contato *</Label>
            <Input id="email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contato@parceiro.com" required />
          </div>

          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free (30 req/min)</SelectItem>
                <SelectItem value="starter">Starter (60 req/min)</SelectItem>
                <SelectItem value="pro">Pro (120 req/min)</SelectItem>
                <SelectItem value="enterprise">Enterprise (300 req/min)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Permissoes (scopes)</Label>
            <div className="space-y-2">
              {AVAILABLE_SCOPES.map(s => (
                <div key={s.value} className="flex items-center gap-2">
                  <Checkbox
                    id={s.value}
                    checked={scopes.includes(s.value)}
                    onCheckedChange={() => toggleScope(s.value)}
                  />
                  <Label htmlFor={s.value} className="text-sm font-normal cursor-pointer">{s.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expiracao (opcional)</Label>
            <Input id="expires" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending || !name || !organizationName || !contactEmail || scopes.length === 0}>
              {createMutation.isPending ? "Criando..." : "Criar Chave"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
