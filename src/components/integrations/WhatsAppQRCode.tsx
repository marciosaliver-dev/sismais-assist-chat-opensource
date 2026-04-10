import { useState } from "react";
import { QrCode, RefreshCw, CheckCircle, Smartphone, Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WhatsAppQRCodeProps {
  status: "disconnected" | "connecting" | "connected" | "qr_pending";
  phone?: string | null;
  qrCode?: string | null;
  isLoading?: boolean;
  onConnect: (instanceId: string, apiToken: string, subdomain: string) => void;
  onDisconnect: () => void;
  onRefreshQR: () => void;
  onCheckStatus?: (subdomain: string, token: string, instanceId: string) => void;
}

export function WhatsAppQRCode({ 
  status, 
  phone, 
  qrCode,
  isLoading,
  onConnect, 
  onDisconnect,
  onRefreshQR,
  onCheckStatus
}: WhatsAppQRCodeProps) {
  const [instanceId, setInstanceId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [showQR, setShowQR] = useState(false);

  const handleConnect = () => {
    if (instanceId && apiToken && subdomain) {
      onConnect(instanceId, apiToken, subdomain);
      setShowQR(true);
    }
  };

  const handleCheckStatus = () => {
    if (instanceId && apiToken && subdomain && onCheckStatus) {
      onCheckStatus(subdomain, apiToken, instanceId);
    }
  };

  const cleanSubdomain = subdomain.replace("https://", "").replace(".uazapi.com", "").replace("http://", "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-whatsapp" />
          Conexão WhatsApp
        </CardTitle>
        <CardDescription>
          Conecte seu número do WhatsApp via QR Code usando a Uazapi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === "connected" ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">WhatsApp Conectado</p>
              {phone && (
                <p className="text-sm text-muted-foreground">{phone}</p>
              )}
            </div>
            <Button variant="outline" onClick={onDisconnect} disabled={isLoading}>
              Desconectar
            </Button>
          </div>
        ) : (
          <>
            {!showQR ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Subdomínio Uazapi</Label>
                  <Input
                    id="subdomain"
                    placeholder="sismais ou https://sismais.uazapi.com"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Será usado como: https://{cleanSubdomain || "[subdomínio]"}.uazapi.com
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instanceId">Instance ID</Label>
                  <Input
                    id="instanceId"
                    placeholder="ID da sua instância"
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiToken">API Token</Label>
                  <Input
                    id="apiToken"
                    type="password"
                    placeholder="Seu token de API"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCheckStatus} 
                    variant="outline"
                    className="flex-1"
                    disabled={!instanceId || !apiToken || !subdomain || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4 mr-2" />
                    )}
                    Verificar Conexão
                  </Button>
                  <Button 
                    onClick={handleConnect} 
                    className="flex-1"
                    disabled={!instanceId || !apiToken || !subdomain || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      "Gerar QR Code"
                    )}
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground text-center">
                  Se sua instância já está conectada, use "Verificar Conexão"
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                {status === "connecting" ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                  </div>
                ) : status === "qr_pending" ? (
                  <>
                    <div className={cn(
                      "w-64 h-64 mx-auto rounded-lg border-2",
                      "flex items-center justify-center bg-white"
                    )}>
                      {qrCode ? (
                        <img 
                          src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} 
                          alt="QR Code WhatsApp" 
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <QrCode className="w-32 h-32 mx-auto text-muted-foreground/50" />
                          <p className="text-xs text-muted-foreground mt-2">
                            Aguardando QR Code...
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Abra o WhatsApp no seu celular e escaneie o código
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={onRefreshQR} disabled={isLoading}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Atualizar QR
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowQR(false)}>
                        Voltar
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
