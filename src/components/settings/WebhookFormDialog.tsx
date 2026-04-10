import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Plus, Trash2, UserPlus, Sparkles, CheckCircle2 } from "lucide-react";
import { useIncomingWebhooks, useWebhookLogs, type IncomingWebhook } from "@/hooks/useIncomingWebhooks";
import { WhatsAppInstanceSelect } from "@/components/shared/WhatsAppInstanceSelect";
import { useFlowAutomations } from "@/hooks/useFlowAutomations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const SYSTEM_FIELDS = [
  { value: "helpdesk_clients.name", label: "Cliente - Nome" },
  { value: "helpdesk_clients.email", label: "Cliente - Email" },
  { value: "helpdesk_clients.phone", label: "Cliente - Telefone" },
  { value: "helpdesk_clients.cnpj", label: "Cliente - CNPJ" },
  { value: "helpdesk_clients.cpf", label: "Cliente - CPF" },
  { value: "helpdesk_clients.company_name", label: "Cliente - Empresa" },
  { value: "helpdesk_clients.notes", label: "Cliente - Observações" },
  { value: "ai_conversations.customer_name", label: "Atendimento - Nome" },
  { value: "ai_conversations.customer_phone", label: "Atendimento - Telefone" },
  { value: "ai_conversations.customer_email", label: "Atendimento - Email" },
  { value: "ai_conversations.tags", label: "Atendimento - Tags" },
];

const DIRECT_ACTION_TYPES = [
  { value: "map_client_fields", label: "Mapear Dados do Cliente" },
  { value: "create_conversation", label: "Criar Novo Atendimento" },
  { value: "assign_board_stage", label: "Atribuir Board/Etapa" },
  { value: "assign_agent", label: "Atribuir Agente" },
  { value: "send_welcome_message", label: "Enviar Mensagem de Boas-vindas" },
];

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: IncomingWebhook | null;
}

export function WebhookFormDialog({ open, onOpenChange, webhook }: WebhookFormDialogProps) {
  const { createWebhook, updateWebhook } = useIncomingWebhooks();
  const { flows } = useFlowAutomations();
  const { data: logs } = useWebhookLogs(webhook?.id || null);

  const { data: boards } = useQuery({
    queryKey: ["kanban-boards"],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_boards").select("*").eq("active", true);
      return data || [];
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["kanban-stages-all"],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_stages").select("*").eq("active", true);
      return data || [];
    },
  });

  const { data: humanAgents } = useQuery({
    queryKey: ["human-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("human_agents").select("*").neq("is_active", false);
      return data || [];
    },
  });

  const { data: aiAgents } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agents").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    is_active: true,
    action_mode: "direct" as "direct" | "flow",
    flow_automation_id: "",
    actions: [] as any[],
    field_mapping: {} as Record<string, string>,
    template_type: null as string | null,
  });

  useEffect(() => {
    if (webhook) {
      setForm({
        name: webhook.name,
        description: webhook.description || "",
        is_active: webhook.is_active,
        action_mode: webhook.action_mode as "direct" | "flow",
        flow_automation_id: webhook.flow_automation_id || "",
        actions: webhook.actions || [],
        field_mapping: webhook.field_mapping || {},
        template_type: webhook.template_type,
      });
    } else {
      setForm({
        name: "",
        description: "",
        is_active: true,
        action_mode: "direct",
        flow_automation_id: "",
        actions: [],
        field_mapping: {},
        template_type: null,
      });
    }
  }, [webhook, open]);

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      is_active: form.is_active,
      action_mode: form.action_mode,
      flow_automation_id: form.flow_automation_id || null,
      actions: form.actions,
      field_mapping: form.field_mapping,
      template_type: form.template_type,
    };

    if (webhook) {
      updateWebhook.mutate({ id: webhook.id, updates: payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createWebhook.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const copyUrl = () => {
    if (webhook?.token) {
      navigator.clipboard.writeText(`${SUPABASE_URL}/functions/v1/webhook-receiver/${webhook.token}`);
      toast.success("URL copiada!");
    }
  };

  const addAction = () => {
    setForm((f) => ({
      ...f,
      actions: [...f.actions, { action_type: "map_client_fields", config: {} }],
    }));
  };

  const removeAction = (index: number) => {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== index) }));
  };

  const updateAction = (index: number, updates: any) => {
    setForm((f) => ({
      ...f,
      actions: f.actions.map((a, i) => (i === index ? { ...a, ...updates } : a)),
    }));
  };

  const addMapping = () => {
    setForm((f) => ({ ...f, field_mapping: { ...f.field_mapping, "": "" } }));
  };

  const updateMapping = (oldKey: string, newKey: string, value: string) => {
    setForm((f) => {
      const newMapping = { ...f.field_mapping };
      if (oldKey !== newKey) delete newMapping[oldKey];
      newMapping[newKey] = value;
      return { ...f, field_mapping: newMapping };
    });
  };

  const removeMapping = (key: string) => {
    setForm((f) => {
      const newMapping = { ...f.field_mapping };
      delete newMapping[key];
      return { ...f, field_mapping: newMapping };
    });
  };

  const applyTemplate = (type: "onboarding" | "inadimplente" | "billing") => {
    if (type === "onboarding") {
      setForm((f) => ({
        ...f,
        template_type: "onboarding",
        actions: [
          { action_type: "map_client_fields", config: {} },
          { action_type: "create_conversation", config: {} },
          { action_type: "assign_agent", config: {} },
          { action_type: "send_welcome_message", config: { message: "Olá {nome}, seja bem-vindo! Como posso ajudar?" } },
        ],
        field_mapping: {
          "name": "helpdesk_clients.name",
          "cnpj": "helpdesk_clients.cnpj",
          "phone": "helpdesk_clients.phone",
          "email": "helpdesk_clients.email",
        },
      }));
      toast.success("Template Onboarding aplicado!");
    } else if (type === "billing") {
      setForm((f) => ({
        ...f,
        template_type: "billing",
        action_mode: "direct",
        actions: [
          { action_type: "map_client_fields", config: {} },
          { action_type: "create_conversation", config: {} },
        ],
        field_mapping: {
          "cliente_nome": "helpdesk_clients.name",
          "cliente_documento": "helpdesk_clients.cnpj",
          "cliente_telefone": "helpdesk_clients.phone",
          "cliente_email": "helpdesk_clients.email",
        },
      }));
      toast.success("Template Cobrança aplicado!");
    } else {
      setForm((f) => ({
        ...f,
        template_type: "inadimplente",
        actions: [
          { action_type: "map_client_fields", config: {} },
          { action_type: "create_conversation", config: {} },
          { action_type: "assign_agent", config: {} },
        ],
        field_mapping: {
          "cnpj": "helpdesk_clients.cnpj",
          "phone": "helpdesk_clients.phone",
          "name": "helpdesk_clients.name",
          "valor_aberto": "ai_conversations.tags",
        },
      }));
      toast.success("Template Inadimplente aplicado!");
    }
  };

  const filteredStages = (boardId: string) => stages?.filter((s) => s.board_id === boardId) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{webhook ? "Editar Webhook" : "Novo Webhook de Entrada"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="action">Ação</TabsTrigger>
            <TabsTrigger value="mapping">Mapeamento</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            {webhook && <TabsTrigger value="logs">Logs</TabsTrigger>}
          </TabsList>

          {/* Tab: Basic */}
          <TabsContent value="basic" className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Novo Cliente CRM" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descreva o que este webhook faz" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>Webhook ativo</Label>
            </div>
            {webhook && (
              <div>
                <Label>URL do Webhook</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={`${SUPABASE_URL}/functions/v1/webhook-receiver/${webhook.token}`} className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={copyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: Action */}
          <TabsContent value="action" className="space-y-4">
            <div>
              <Label>Modo de Ação</Label>
              <Select value={form.action_mode} onValueChange={(v) => setForm((f) => ({ ...f, action_mode: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Ações Diretas</SelectItem>
                  <SelectItem value="flow">Executar Fluxo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.action_mode === "flow" ? (
              <div>
                <Label>Fluxo de Automação</Label>
                <Select value={form.flow_automation_id} onValueChange={(v) => setForm((f) => ({ ...f, flow_automation_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
                  <SelectContent>
                    {flows?.map((fl) => (
                      <SelectItem key={fl.id} value={fl.id}>{fl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ações Diretas</Label>
                  <Button variant="outline" size="sm" onClick={addAction}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Ação
                  </Button>
                </div>
                {form.actions.map((action, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Select value={action.action_type} onValueChange={(v) => updateAction(idx, { action_type: v, config: {} })}>
                          <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DIRECT_ACTION_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAction(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Config forms per action type */}
                      {action.action_type === "create_conversation" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Board</Label>
                              <Select value={action.config?.board_id || ""} onValueChange={(v) => updateAction(idx, { config: { ...action.config, board_id: v } })}>
                                <SelectTrigger><SelectValue placeholder="Board" /></SelectTrigger>
                                <SelectContent>
                                  {boards?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Etapa</Label>
                              <Select value={action.config?.stage_id || ""} onValueChange={(v) => updateAction(idx, { config: { ...action.config, stage_id: v } })}>
                                <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
                                <SelectContent>
                                  {filteredStages(action.config?.board_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <WhatsAppInstanceSelect
                            value={action.config?.instance_id || ""}
                            onChange={(v) => updateAction(idx, { config: { ...action.config, instance_id: v } })}
                            label="Canal de envio"
                            required
                          />
                          <div>
                            <Label className="text-xs">Número do cliente (campo do payload)</Label>
                            <Input
                              value={action.config?.customer_phone_field || ""}
                              onChange={(e) => updateAction(idx, { config: { ...action.config, customer_phone_field: e.target.value } })}
                              placeholder="Ex: phone ou dados.telefone"
                              className="text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {action.action_type === "assign_board_stage" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Board</Label>
                            <Select value={action.config?.board_id || ""} onValueChange={(v) => updateAction(idx, { config: { ...action.config, board_id: v } })}>
                              <SelectTrigger><SelectValue placeholder="Board" /></SelectTrigger>
                              <SelectContent>
                                {boards?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Etapa</Label>
                            <Select value={action.config?.stage_id || ""} onValueChange={(v) => updateAction(idx, { config: { ...action.config, stage_id: v } })}>
                              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
                              <SelectContent>
                                {filteredStages(action.config?.board_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {action.action_type === "assign_agent" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Agente Humano</Label>
                            <Select value={action.config?.human_agent_id || ""} onValueChange={(v) => updateAction(idx, { config: { ...action.config, human_agent_id: v } })}>
                              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                {humanAgents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Agente IA</Label>
                            <Select value={action.config?.ai_agent_id || ""} onValueChange={(v) => updateAction(idx, { config: { ...action.config, ai_agent_id: v } })}>
                              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                {aiAgents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {action.action_type === "send_welcome_message" && (
                        <div>
                          <Label className="text-xs">Mensagem</Label>
                          <Textarea
                            value={action.config?.message || ""}
                            onChange={(e) => updateAction(idx, { config: { ...action.config, message: e.target.value } })}
                            placeholder="Olá {nome}, seja bem-vindo!"
                            rows={2}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Variáveis: {"{nome}"}, {"{empresa}"}, {"{telefone}"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Mapping */}
          <TabsContent value="mapping" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Mapeamento de Campos do Payload</Label>
              <Button variant="outline" size="sm" onClick={addMapping}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mapeie campos do JSON recebido para campos do sistema. Ex: <code>client.name</code> → <code>helpdesk_clients.name</code>
            </p>
            {Object.entries(form.field_mapping).map(([key, value], idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={key}
                  onChange={(e) => updateMapping(key, e.target.value, value)}
                  placeholder="campo.do.payload"
                  className="flex-1 font-mono text-xs"
                />
                <span className="text-muted-foreground">→</span>
                <Select value={value} onValueChange={(v) => updateMapping(key, key, v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Campo do sistema" /></SelectTrigger>
                  <SelectContent>
                    {SYSTEM_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMapping(key)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </TabsContent>

          {/* Tab: Templates */}
          <TabsContent value="templates" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um template pré-configurado para preencher automaticamente as ações e mapeamento.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => applyTemplate("onboarding")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <CardTitle className="text-sm">Novo Cliente para Onboarding</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">
                    Cria cliente, abre atendimento no board de Onboarding, atribui agente e envia mensagem de boas-vindas via WhatsApp.
                  </CardDescription>
                  {form.template_type === "onboarding" && (
                    <Badge variant="default" className="mt-2"><CheckCircle2 className="h-3 w-3 mr-1" /> Aplicado</Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => applyTemplate("inadimplente")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-sm">Cliente Inadimplente para Cobranças</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">
                    Busca cliente por CNPJ/telefone, cria atendimento no board de Cobranças na etapa "Inadimplente", atribui agente financeiro.
                  </CardDescription>
                  {form.template_type === "inadimplente" && (
                    <Badge variant="default" className="mt-2"><CheckCircle2 className="h-3 w-3 mr-1" /> Aplicado</Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => applyTemplate("billing")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                    <CardTitle className="text-sm">Cobrança (Asaas, Eduzz, Guru)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">
                    Recebe eventos de cobrança, deduplica por fatura, classifica automaticamente e cria ticket no board de Gestão de Cobranças.
                  </CardDescription>
                  {form.template_type === "billing" && (
                    <Badge variant="default" className="mt-2"><CheckCircle2 className="h-3 w-3 mr-1" /> Aplicado</Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Logs */}
          {webhook && (
            <TabsContent value="logs" className="space-y-4">
              <Label>Últimos Payloads Recebidos</Label>
              {!logs?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum log registrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {logs.slice(0, 5).map((log) => (
                    <Card key={log.id}>
                      <CardContent className="pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={log.execution_status === "success" ? "default" : log.execution_status === "error" ? "destructive" : "secondary"}>
                            {log.execution_status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                            {log.execution_time_ms && ` • ${log.execution_time_ms}ms`}
                          </span>
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-destructive">{log.error_message}</p>
                        )}
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>
            {webhook ? "Salvar" : "Criar Webhook"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
