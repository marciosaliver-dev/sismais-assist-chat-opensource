import { useState, useEffect } from "react";
import { Smartphone, Save, Globe, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUazapiInstance } from "@/hooks/useUazapiInstance";
import { toast } from "sonner";

export function InstanceSetup() {
  const { instance, isLoading, saveInstance } = useUazapiInstance();

  const [instanceName, setInstanceName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (instance) {
      setInstanceName(instance.instance_name);
      setApiUrl(instance.api_url);
      setApiToken(instance.api_token);
    }
  }, [instance]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-webhook`;

  const handleSave = () => {
    if (!instanceName || !apiUrl || !apiToken) return;
    saveInstance.mutate({
      instance_name: instanceName,
      api_url: apiUrl.replace(/\/$/, ""),
      api_token: apiToken,
      webhook_url: webhookUrl,
    });
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL do webhook copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--whatsapp))]/10 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-[hsl(var(--whatsapp))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurar Instância UAZAPI</h1>
          <p className="text-muted-foreground text-sm">Informe os dados da sua instância já conectada no painel UAZAPI</p>
        </div>
      </div>

      {/* Status salvo */}
      {instance && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--success))]" />
              <span className="font-medium text-foreground">Instância configurada</span>
              {instance.phone_number && <Badge variant="secondary">{instance.phone_number}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-5 h-5" /> URL do Webhook
          </CardTitle>
          <CardDescription>Configure esta URL no painel da UAZAPI para receber mensagens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="bg-secondary border-none text-sm font-mono" />
            <Button variant="outline" size="icon" onClick={copyWebhookUrl} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-[hsl(var(--success))]" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Config form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Instância</CardTitle>
          <CardDescription>Preencha com os dados da instância configurada no painel UAZAPI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Instância</Label>
            <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="minha-instancia" />
          </div>
          <div className="space-y-2">
            <Label>URL da API (UAZAPI)</Label>
            <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://seu-subdominio.uazapi.com" />
          </div>
          <div className="space-y-2">
            <Label>Token da API</Label>
            <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="seu-token-aqui" />
          </div>
          <Button onClick={handleSave} disabled={saveInstance.isPending || !instanceName || !apiUrl || !apiToken} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saveInstance.isPending ? "Salvando..." : "Salvar Instância"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}