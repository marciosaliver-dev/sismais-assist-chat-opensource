import { ArrowLeft, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { WhatsAppQRCode } from "@/components/integrations/WhatsAppQRCode";
import { WhatsAppAutomation } from "@/components/integrations/WhatsAppAutomation";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

export default function WhatsAppIntegration() {
  const navigate = useNavigate();
  const { config, updateAIAutomation } = useWhatsAppConfig();
  const { 
    connectionStatus, 
    phone, 
    qrCode,
    isLoading,
    connect, 
    disconnect, 
    refreshQR,
    checkStatusWithCredentials
  } = useWhatsAppInstance();
  
  const [copied, setCopied] = useState(false);
  
  // Webhook URL for Uazapi configuration
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const handleConnect = (instanceId: string, apiToken: string, subdomain: string) => {
    const cleanSubdomain = subdomain.replace("https://", "").replace(".uazapi.com", "").replace("http://", "");
    connect(cleanSubdomain, apiToken, instanceId, "WhatsApp Principal");
  };

  const handleCheckStatus = (subdomain: string, token: string, instanceId: string) => {
    const cleanSubdomain = subdomain.replace("https://", "").replace(".uazapi.com", "").replace("http://", "");
    checkStatusWithCredentials(cleanSubdomain, token, instanceId);
  };

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/admin/integrations")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Integração WhatsApp (Uazapi)
            </h1>
            <p className="text-muted-foreground">
              Configure a conexão e automação do WhatsApp
            </p>
          </div>
        </div>

        {/* Webhook URL Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Webhook URL</CardTitle>
            <CardDescription>
              Configure esta URL no painel da Uazapi para receber mensagens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">
                {webhookUrl}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              No painel Uazapi, vá em Configurações → Webhooks e adicione esta URL
            </p>
          </CardContent>
        </Card>

        {/* Connection Card */}
        <WhatsAppQRCode
          status={connectionStatus}
          phone={phone}
          qrCode={qrCode}
          isLoading={isLoading}
          onConnect={handleConnect}
          onDisconnect={disconnect}
          onRefreshQR={refreshQR}
          onCheckStatus={handleCheckStatus}
        />

        {/* Automation Card */}
        <WhatsAppAutomation
          automation={config.aiAutomation}
          onUpdate={updateAIAutomation}
          disabled={connectionStatus !== "connected"}
        />
      </div>
    </div>
  );
}
