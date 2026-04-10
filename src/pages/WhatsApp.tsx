import { Smartphone } from 'lucide-react'
import { ConnectionConfig } from '@/components/whatsapp/ConnectionConfig'
import { MessageTemplates } from '@/components/whatsapp/MessageTemplates'
import { MessageLogs } from '@/components/whatsapp/MessageLogs'
import { SendTestMessage } from '@/components/whatsapp/SendTestMessage'

export default function WhatsAppPage() {
  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-foreground">
            <Smartphone className="w-6 h-6 text-[hsl(var(--whatsapp))]" />
            <h1 className="text-2xl font-bold">WhatsApp Business</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Configure e gerencie a integração com WhatsApp Business API oficial da Meta
          </p>
        </div>

        {/* Configuration */}
        <ConnectionConfig />

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SendTestMessage />
          <MessageTemplates />
        </div>

        {/* Logs */}
        <MessageLogs />
      </div>
    </div>
  )
}
