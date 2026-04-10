import { useState } from "react";
import { Webhook, Plus, Copy, Trash2, Pencil, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIncomingWebhooks } from "@/hooks/useIncomingWebhooks";
import { useOutgoingWebhooks, OutgoingWebhook } from "@/hooks/useOutgoingWebhooks";
import { WebhookFormDialog } from "@/components/settings/WebhookFormDialog";
import { OutgoingWebhookFormDialog } from "@/components/settings/OutgoingWebhookFormDialog";
import { PlatformAIAssistant } from "@/components/settings/PlatformAIAssistant";
import { toast } from "sonner";
import { format } from "date-fns";

const SUPABASE_URL = "https://pomueweeulenslxvsxar.supabase.co";

const EVENT_LABELS: Record<string, string> = {
  conversation_created: "Atendimento criado",
  human_started: "Iniciado por humano",
  status_aguardando: "Status → Aguardando",
  status_em_atendimento: "Status → Em Atendimento",
  status_finalizado: "Status → Finalizado",
  stage_changed: "Etapa mudou",
  board_changed: "Board mudou",
  client_linked: "Cliente associado",
  csat_responded: "CSAT respondido",
  sla_first_response_breached: "SLA ultrapassado",
  agent_assigned: "Agente atribuído",
};

const IntegrationsWebhooksTab = () => {
  const { webhooks, isLoading, deleteWebhook } = useIncomingWebhooks();
  const { webhooks: outgoingWebhooks, isLoading: outLoading, deleteWebhook: deleteOutgoing } = useOutgoingWebhooks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [outDialogOpen, setOutDialogOpen] = useState(false);
  const [editingOutWebhook, setEditingOutWebhook] = useState<OutgoingWebhook | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${SUPABASE_URL}/functions/v1/webhook-receiver/${token}`);
    toast.success("URL copiada!");
  };

  const handleAIApplyConfig = (tool: string, config: any) => {
    if (tool === 'generate_webhook_config') {
      setEditingWebhook(null);
      // Pre-fill webhook form with AI-generated config
      setDialogOpen(true);
      // Store the config so the dialog can pick it up
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ai-webhook-config', { detail: config }));
      }, 100);
      setShowAIAssistant(false);
    }
  };

  return (
    <div className="webhooks-settings">
      {/* ========== WEBHOOKS DE ENTRADA ========== */}
      <div className="webhooks-card">
        <div className="webhooks-card-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Webhook className="w-5 h-5" />
              Webhooks de Entrada
            </h3>
            <p className="sc-desc">Receba dados de sistemas externos via webhook.</p>
          </div>
          <div className="sc-actions">
            <Button variant="outline" size="sm" onClick={() => setShowAIAssistant(!showAIAssistant)}>
              <Sparkles className="w-4 h-4" />
              Configurar com IA
            </Button>
            <Button size="sm" onClick={() => { setEditingWebhook(null); setDialogOpen(true); }} className="btn-primary">
              <Plus className="w-4 h-4" />
              Novo Webhook
            </Button>
          </div>
        </div>
        <div className="webhooks-card-content">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !webhooks?.length ? (
            <div className="empty-state">
              <Webhook className="w-10 h-10" />
              <p>Nenhum webhook de entrada configurado</p>
              <p className="text-sm">Crie um webhook para receber dados de sistemas externos</p>
            </div>
          ) : (
            <table className="webhooks-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Último Disparo</th>
                  <th>Disparos</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td className="font-medium">
                      <div>{wh.name}</div>
                      {wh.description && <div className="text-xs text-muted-foreground">{wh.description}</div>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                          .../{wh.token.slice(0, 8)}...
                        </code>
                        <button className="sc-btn-icon" onClick={() => copyUrl(wh.token)} aria-label="Copiar URL">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <Badge variant={wh.is_active ? "default" : "secondary"}>
                        {wh.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {wh.last_triggered_at ? format(new Date(wh.last_triggered_at), "dd/MM/yyyy HH:mm") : "Nunca"}
                    </td>
                    <td className="text-sm">{wh.trigger_count}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="sc-btn-icon" onClick={() => { setEditingWebhook(wh); setDialogOpen(true); }} aria-label="Editar">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button className="sc-btn-icon sc-btn-del" onClick={() => deleteWebhook.mutate(wh.id)} aria-label="Excluir">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========== WEBHOOKS DE SAÍDA ========== */}
      <div className="settings-card">
        <div className="sc-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Send className="w-5 h-5" />
              Webhooks de Saída
            </h3>
            <p className="sc-desc">Dispare webhooks quando eventos ocorrerem.</p>
          </div>
          <Button size="sm" onClick={() => { setEditingOutWebhook(null); setOutDialogOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Novo Webhook
          </Button>
        </div>
        <div className="sc-content">
          {outLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !outgoingWebhooks.length ? (
            <div className="empty-state">
              <Send className="w-10 h-10" />
              <p>Nenhum webhook de saída configurado</p>
              <p className="text-sm">Configure webhooks para notificar sistemas externos</p>
            </div>
          ) : (
            <table className="webhooks-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>URL</th>
                  <th>Evento</th>
                  <th>Status</th>
                  <th>Último Disparo</th>
                  <th>Disparos</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {outgoingWebhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td className="font-medium">
                      <div>{wh.name}</div>
                      {wh.description && <div className="text-xs text-muted-foreground">{wh.description}</div>}
                    </td>
                    <td>
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                        {wh.url.length > 35 ? wh.url.slice(0, 35) + "..." : wh.url}
                      </code>
                    </td>
                    <td>
                      <Badge variant="outline" className="text-xs">
                        {EVENT_LABELS[wh.event_type] || wh.event_type}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={wh.is_active ? "default" : "secondary"}>
                        {wh.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {wh.last_triggered_at ? format(new Date(wh.last_triggered_at), "dd/MM/yyyy HH:mm") : "Nunca"}
                    </td>
                    <td className="text-sm">{wh.trigger_count}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="sc-btn-icon" onClick={() => { setEditingOutWebhook(wh); setOutDialogOpen(true); }} aria-label="Editar">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button className="sc-btn-icon sc-btn-del" onClick={() => deleteOutgoing.mutate(wh.id)} aria-label="Excluir">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* AI Assistant Panel */}
      {showAIAssistant && (
        <div className="w-[380px] shrink-0 h-[600px] border rounded-lg overflow-hidden">
          <PlatformAIAssistant context="webhook" onApplyConfig={handleAIApplyConfig} onClose={() => setShowAIAssistant(false)} />
        </div>
      )}

      <WebhookFormDialog open={dialogOpen} onOpenChange={setDialogOpen} webhook={editingWebhook} />
      <OutgoingWebhookFormDialog open={outDialogOpen} onOpenChange={setOutDialogOpen} webhook={editingOutWebhook} />

      <style>{`
        .webhooks-settings { display: flex; flex-direction: column; gap: 16px; }
        .settings-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 12px; overflow: hidden; }
        .sc-header { padding: 20px; border-bottom: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .sc-info { flex: 1; }
        .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .sc-title .w-5.h-5 { color: #45E5E5; }
        .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .sc-actions { display: flex; gap: 8px; }
        .sc-content { padding: 0; }
        .empty-state { padding: 40px; text-align: center; color: #888; }
        .empty-state .w-10.h-10 { margin: 0 auto 12px; opacity: 0.4; }
        .empty-state p { margin: 0; }
        .webhooks-table { width: 100%; border-collapse: collapse; }
        .webhooks-table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 1px solid #E5E5E5; background: #F8FAFC; }
        .webhooks-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0F0F0; }
        .webhooks-table tr:hover { background: #F8FAFC; }
        .sc-btn-icon { width: 28px; height: 28px; border: none; background: transparent; color: #888; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 150ms; }
        .sc-btn-icon:hover { background: #E8F9F9; color: #10293F; }
        .sc-btn-del:hover { background: #FEF2F2; color: #DC2626; }
      `}</style>
    </div>
  );
};

export default IntegrationsWebhooksTab;
