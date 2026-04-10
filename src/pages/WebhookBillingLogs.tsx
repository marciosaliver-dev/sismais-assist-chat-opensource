import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Webhook,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const actionColors: Record<string, string> = {
  created: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  updated: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  moved_to_billing: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  moved: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  skipped: "bg-muted text-muted-foreground border-border",
};

const actionIcons: Record<string, typeof CheckCircle2> = {
  created: CheckCircle2,
  updated: ArrowRightLeft,
  moved_to_billing: ArrowRightLeft,
  moved: ArrowRightLeft,
  error: AlertCircle,
};

const platformColors: Record<string, string> = {
  asaas: "bg-green-500/15 text-green-600 border-green-500/30",
  eduzz: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  guru: "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

export default function WebhookBillingLogs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["webhook-billing-logs", platformFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("webhook_billing_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (platformFilter !== "all") {
        query = query.eq("plataforma", platformFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action_taken", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (logs || []).filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.cliente_nome?.toLowerCase().includes(s) ||
      log.cliente_documento?.toLowerCase().includes(s) ||
      log.cliente_telefone?.includes(s) ||
      log.evento?.toLowerCase().includes(s) ||
      String(log.ticket_number || "").includes(s)
    );
  });

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              Webhooks de Cobrança
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Logs de webhooks recebidos das plataformas de pagamento
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, documento, ticket..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="asaas">Asaas</SelectItem>
              <SelectItem value="eduzz">Eduzz</SelectItem>
              <SelectItem value="guru">Guru</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="created">Criado</SelectItem>
              <SelectItem value="updated">Atualizado</SelectItem>
              <SelectItem value="moved_to_billing">Movido p/ Cobrança</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="skipped">Ignorado</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]" />
                <TableHead>Data</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  const ActionIcon = actionIcons[log.action_taken] || AlertCircle;
                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedRow(isExpanded ? null : log.id)}>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="px-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={platformColors[log.plataforma?.toLowerCase() || ""] || "bg-muted text-muted-foreground"}>
                              {(log.plataforma || "—").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[180px] truncate">
                            {log.evento || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium truncate max-w-[160px]">{log.cliente_nome || "—"}</div>
                            {log.cliente_documento && (
                              <div className="text-xs text-muted-foreground">{log.cliente_documento}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${actionColors[log.action_taken] || ""}`}>
                              <ActionIcon className="h-3 w-3" />
                              {log.action_taken}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.ticket_number ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-primary hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/kanban/billing");
                                }}
                              >
                                #{log.ticket_number} <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {log.execution_time_ms != null ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {log.execution_time_ms}ms
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-4">
                            <div className="space-y-2">
                              {log.error_message && (
                                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                                  <strong>Erro:</strong> {log.error_message}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><strong>Telefone:</strong> {log.cliente_telefone || "—"}</div>
                                <div><strong>Conversation ID:</strong> {log.conversation_id ? log.conversation_id.substring(0, 8) + "..." : "—"}</div>
                                <div><strong>Movido p/ Cobrança:</strong> {log.moved_to_billing ? "Sim ✅" : "Não"}</div>
                                <div><strong>Board anterior:</strong> {log.existing_board_id ? log.existing_board_id.substring(0, 8) + "..." : "—"}</div>
                              </div>
                              {log.payload && (
                                <details className="mt-2">
                                  <summary className="text-xs font-medium cursor-pointer text-primary hover:underline">
                                    Ver payload completo
                                  </summary>
                                  <pre className="mt-2 p-3 bg-background border border-border rounded-lg text-xs overflow-auto max-h-[300px] whitespace-pre-wrap">
                                    {JSON.stringify(log.payload, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
