import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { useWhatsAppBusiness } from '@/hooks/useWhatsAppBusiness'
import { toast } from 'sonner'

export function ConnectionConfig() {
  const { account, saveAccount, testConnection, disconnect } = useWhatsAppBusiness()
  const [showToken, setShowToken] = useState(false)
  const [formData, setFormData] = useState({
    business_account_id: '',
    phone_number_id: '',
    phone_number: '',
    access_token: '',
    webhook_verify_token: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        business_account_id: account.business_account_id || '',
        phone_number_id: account.phone_number_id || '',
        phone_number: account.phone_number || '',
        access_token: account.access_token || '',
        webhook_verify_token: account.webhook_verify_token || crypto.randomUUID()
      })
    } else {
      setFormData(prev => ({
        ...prev,
        webhook_verify_token: prev.webhook_verify_token || crypto.randomUUID()
      }))
    }
  }, [account])

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-meta-webhook`

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const handleTest = () => {
    if (!formData.phone_number_id || !formData.access_token) {
      toast.error('Preencha Phone Number ID e Access Token')
      return
    }
    testConnection.mutate({
      phone_number_id: formData.phone_number_id,
      access_token: formData.access_token
    })
  }

  const handleSave = () => {
    if (!formData.business_account_id || !formData.phone_number_id || !formData.phone_number || !formData.access_token) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    saveAccount.mutate({
      business_account_id: formData.business_account_id,
      phone_number_id: formData.phone_number_id,
      phone_number: formData.phone_number,
      access_token: formData.access_token,
      webhook_verify_token: formData.webhook_verify_token,
      webhook_url: webhookUrl,
    })
  }

  const maskToken = (token: string) => {
    if (!token) return ''
    if (token.length <= 10) return '••••••••'
    return token.slice(0, 6) + '••••••••' + token.slice(-4)
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            ⚙️ Configuração WhatsApp Business API
          </CardTitle>
          {account?.is_active && (
            <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Instructions */}
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-sm">
            Para conectar, crie um app no{' '}
            <a
              href="https://developers.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary inline-flex items-center gap-1"
            >
              Meta for Developers <ExternalLink className="w-3 h-3" />
            </a>
            {' '}e adicione o produto WhatsApp Business API.
          </AlertDescription>
        </Alert>

        {/* Business Account ID */}
        <div className="space-y-1.5">
          <Label>Business Account ID</Label>
          <Input
            value={formData.business_account_id}
            onChange={(e) => setFormData(prev => ({ ...prev, business_account_id: e.target.value }))}
            placeholder="123456789012345"
          />
          <p className="text-xs text-muted-foreground">WhatsApp Manager → Configurações → Business Info</p>
        </div>

        {/* Phone Number ID */}
        <div className="space-y-1.5">
          <Label>Phone Number ID</Label>
          <Input
            value={formData.phone_number_id}
            onChange={(e) => setFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
            placeholder="987654321098765"
          />
          <p className="text-xs text-muted-foreground">WhatsApp Manager → API Setup</p>
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <Label>Número WhatsApp</Label>
          <Input
            value={formData.phone_number}
            onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
            placeholder="+5511999999999"
          />
        </div>

        {/* Access Token */}
        <div className="space-y-1.5">
          <Label>Access Token (Permanente)</Label>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={formData.access_token}
              onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
              placeholder="EAAxxxxxxxxxx..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Meta for Developers → App → WhatsApp → API Setup</p>
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label>Webhook URL (Configure na Meta)</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => handleCopy(webhookUrl)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Meta for Developers → Webhooks → Edit Subscription</p>
        </div>

        {/* Verify Token */}
        <div className="space-y-1.5">
          <Label>Verify Token</Label>
          <div className="flex gap-2">
            <Input
              value={formData.webhook_verify_token}
              onChange={(e) => setFormData(prev => ({ ...prev, webhook_verify_token: e.target.value }))}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={() => handleCopy(formData.webhook_verify_token)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Use este token ao configurar o webhook na Meta</p>
        </div>

        {/* Status info */}
        {account?.is_active && (
          <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Quality Rating:</span>
              <Badge variant={
                account.quality_rating === 'GREEN' ? 'default' :
                account.quality_rating === 'YELLOW' ? 'secondary' : 'destructive'
              }>
                {account.quality_rating === 'GREEN' ? '🟢' :
                 account.quality_rating === 'YELLOW' ? '🟡' : '🔴'} {account.quality_rating || 'N/A'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Messaging Limit:</span>
              <span className="text-foreground font-medium">
                {account.messaging_limit_tier || 'N/A'}
                {account.current_limit ? ` (${account.current_limit.toLocaleString()} msgs/dia)` : ''}
              </span>
            </div>
            {account.display_name && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Nome:</span>
                <span className="text-foreground font-medium">{account.display_name}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
            {testConnection.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testando...</>
            ) : 'Testar Conexão'}
          </Button>

          <Button onClick={handleSave} disabled={saveAccount.isPending}>
            {saveAccount.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
            ) : 'Salvar Configuração'}
          </Button>

          {account?.is_active && (
            <Button variant="destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
