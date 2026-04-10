import { MessageSquare, Sparkles, Database, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "connected" | "pending" | "disconnected";
  statusLabel: string;
}

const integrations: Integration[] = [
  {
    id: "whatsapp",
    name: "Uazapi (WhatsApp)",
    description: "Integração com WhatsApp via webhook Uazapi para receber e enviar mensagens",
    icon: MessageSquare,
    status: "pending",
    statusLabel: "Aguardando configuração",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "IA Generativa para análise de conversas e sugestões de respostas",
    icon: Sparkles,
    status: "pending",
    statusLabel: "Aguardando API Key",
  },
  {
    id: "sismais",
    name: "SisCRM",
    description: "Integração com o CRM para sincronização de clientes e histórico",
    icon: Database,
    status: "disconnected",
    statusLabel: "Não configurado",
  },
];

const statusConfig = {
  connected: {
    icon: CheckCircle,
    class: "text-success",
    bgClass: "bg-success/10",
  },
  pending: {
    icon: AlertCircle,
    class: "text-warning",
    bgClass: "bg-warning/10",
  },
  disconnected: {
    icon: AlertCircle,
    class: "text-muted-foreground",
    bgClass: "bg-muted",
  },
};

export default function AdminIntegrations() {
  const navigate = useNavigate();
  const { config } = useWhatsAppConfig();

  // Update WhatsApp status based on stored config
  const getWhatsAppStatus = () => {
    if (config.connection?.status === "connected") return "connected";
    if (config.connection) return "pending";
    return "pending";
  };

  const getWhatsAppLabel = () => {
    if (config.connection?.status === "connected") return "Conectado";
    if (config.connection) return "Aguardando conexão";
    return "Aguardando configuração";
  };

  const dynamicIntegrations = integrations.map((integration) => {
    if (integration.id === "whatsapp") {
      return {
        ...integration,
        status: getWhatsAppStatus(),
        statusLabel: getWhatsAppLabel(),
      };
    }
    return integration;
  });

  const handleConfigure = (integrationId: string) => {
    if (integrationId === "whatsapp") {
      navigate("/admin/whatsapp");
    }
  };

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-muted-foreground">Configure as integrações do sistema</p>
        </div>

        {/* Integrations List */}
        <div className="space-y-4">
          {dynamicIntegrations.map((integration) => {
            const StatusIcon = statusConfig[integration.status].icon;
            
            return (
              <div
                key={integration.id}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center",
                      integration.id === "whatsapp" && "bg-whatsapp/10 text-whatsapp",
                      integration.id === "gemini" && "bg-copilot/10 text-copilot",
                      integration.id === "sismais" && "bg-primary/10 text-primary"
                    )}>
                      <integration.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{integration.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {integration.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <StatusIcon className={cn("w-4 h-4", statusConfig[integration.status].class)} />
                        <span className={cn("text-sm", statusConfig[integration.status].class)}>
                          {integration.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="outline"
                    onClick={() => handleConfigure(integration.id)}
                  >
                    Configurar
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
          <p>
            <strong>Nota:</strong> As configurações de integração serão implementadas após 
            a conexão com o Lovable Cloud para armazenamento seguro de credenciais.
          </p>
        </div>
      </div>
    </div>
  );
}
