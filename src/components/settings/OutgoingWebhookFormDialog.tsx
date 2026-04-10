import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useOutgoingWebhooks, OutgoingWebhook } from "@/hooks/useOutgoingWebhooks";
import { useKanbanBoards } from "@/hooks/useKanbanBoards";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, Play, Loader2, Info } from "lucide-react";
import { format } from "date-fns";

const EVENT_OPTIONS = [
  { value: "conversation_created", label: "Atendimento criado" },
  { value: "human_started", label: "Atendimento iniciado por humano" },
  { value: "status_aguardando", label: "Status mudou para Aguardando" },
  { value: "status_em_atendimento", label: "Status mudou para Em Atendimento" },
  { value: "status_finalizado", label: "Status mudou para Finalizado" },
  { value: "stage_changed", label: "Ticket movido entre etapas do Kanban" },
  { value: "board_changed", label: "Ticket movido entre boards" },
  { value: "client_linked", label: "Cliente associado ao ticket" },
  { value: "csat_responded", label: "CSAT respondido pelo cliente" },
  { value: "sla_first_response_breached", label: "SLA de primeira resposta ultrapassado" },
  { value: "agent_assigned", label: "Agente atribuído ao ticket" },
];

const VARIABLES_LIST = [
  "{conversation_id}", "{ticket_status}", "{kanban_stage}", "{kanban_board}",
  "{client_name}", "{client_phone}", "{client_cnpj}", "{client_company}",
  "{subscribed_product}", "{human_agent_name}", "{priority}", "{category}",
  "{module}", "{first_response_seconds}", "{resolution_seconds}",
  "{csat_score}", "{created_at}", "{resolved_at}", "{custom_payload}",
];

const DEFAULT_BODY = `{
  "event": "{ticket_status}",
  "conversation_id": "{conversation_id}",
  "client_name": "{client_name}",
  "client_phone": "{client_phone}",
  "priority": "{priority}",
  "csat_score": "{csat_score}",
  "board": "{kanban_board}",
  "stage": "{kanban_stage}"
}`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  webhook?: OutgoingWebhook | null;
}

export function OutgoingWebhookFormDialog({ open, onOpenChange, webhook }: Props) {
  const { createWebhook, updateWebhook, testWebhook, useWebhookLogs } = useOutgoingWebhooks();
  const { data: boards } = useKanbanBoards();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("POST");
  const [eventType, setEventType] = useState("");
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY);
  const [isActive, setIsActive] = useState(true);
  const [filterBoardId, setFilterBoardId] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const { data: logs } = useWebhookLogs(webhook?.id ?? "");

  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setDescription(webhook.description || "");
      setUrl(webhook.url);
      setMethod(webhook.method);
      setEventType(webhook.event_type);
      setHeaders(
        Object.entries(webhook.headers || {}).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      );
      setBodyTemplate(webhook.body_template || DEFAULT_BODY);
      setIsActive(webhook.is_active);
      setFilterBoardId((webhook.filters as any)?.board_id || "");
      setFilterPriority((webhook.filters as any)?.priority || "");
    } else {
      setName("");
      setDescription("");
      setUrl("");
      setMethod("POST");
      setEventType("");
      setHeaders([]);
      setBodyTemplate(DEFAULT_BODY);
      setIsActive(true);
      setFilterBoardId("");
      setFilterPriority("");
    }
    setTestResult(null);
  }, [webhook, open]);

  const handleSave = () => {
    if (!name || !url || !eventType) {
      toast.error("Preencha nome, URL e evento");
      return;
    }

    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key) headersObj[h.key] = h.value;
    });

    const filters: Record<string, any> = {};
    if (filterBoardId) filters.board_id = filterBoardId;
    if (filterPriority) filters.priority = filterPriority;

    const payload = {
      name,
      description: description || null,
      url,
      method,
      event_type: eventType,
      headers: headersObj,
      filters,
      body_template: bodyTemplate || null,
      is_active: isActive,
    };

    if (webhook) {
      updateWebhook.mutate({ id: webhook.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createWebhook.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleTest = async () => {
    if (!webhook) {
      toast.error("Salve o webhook antes de testar");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testWebhook(webhook.id);
      setTestResult(result);
      if (result.success) toast.success("Teste enviado com sucesso!");
      else toast.error("Teste falhou: " + (result.error || `HTTP ${result.status}`));
    } catch (err) {
      toast.error("Erro ao testar webhook");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {webhook ? "Editar Webhook de Saída" : "Novo Webhook de Saída"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Notificar CRM" />
            </div>
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional" />
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-4">
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/webhook" />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Headers</Label>
              <Button variant="ghost" size="sm" onClick={() => setHeaders([...headers, { key: "", value: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Chave" value={h.key} onChange={(e) => {
                  const copy = [...headers];
                  copy[i].key = e.target.value;
                  setHeaders(copy);
                }} className="flex-1" />
                <Input placeholder="Valor" value={h.value} onChange={(e) => {
                  const copy = [...headers];
                  copy[i].value = e.target.value;
                  setHeaders(copy);
                }} className="flex-1" />
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setHeaders(headers.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0">
                <span className="text-sm font-medium">Filtros opcionais</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Board</Label>
                  <Select value={filterBoardId} onValueChange={setFilterBoardId}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {boards?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Body template */}
          <div className="space-y-2">
            <Label>Body (template JSON)</Label>
            <Textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              className="font-mono text-xs min-h-[150px]"
              placeholder="Template JSON com variáveis"
            />
            <div className="flex items-start gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Variáveis disponíveis: {VARIABLES_LIST.join(", ")}</span>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Ativo</Label>
          </div>

          {/* Test button */}
          {webhook && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  Testar
                </Button>
                {testResult && (
                  <Badge variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? `OK (${testResult.status})` : `Erro (${testResult.status || "N/A"})`}
                  </Badge>
                )}
              </div>

              {testResult && (
                <pre className="text-xs bg-muted p-3 rounded max-h-[120px] overflow-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              )}

              {/* Recent logs */}
              {logs && logs.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Últimos disparos</Label>
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-center gap-2 text-xs">
                      <Badge variant={log.execution_status === "success" ? "default" : "destructive"} className="text-xs">
                        {log.execution_status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM HH:mm")}
                      </span>
                      {log.execution_time_ms && (
                        <span className="text-muted-foreground">{log.execution_time_ms}ms</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              {webhook ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
