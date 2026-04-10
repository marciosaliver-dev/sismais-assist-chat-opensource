import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, MessageSquare, Shield, DollarSign, Brain, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAgentActivity } from "@/hooks/useAgentActivity";

type Preset = "today" | "7d" | "30d";

function getDateRange(preset: Preset) {
  const end = new Date();
  const start = new Date();
  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }
  return { start, end };
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const specialtyLabels: Record<string, string> = {
  triage: "Triagem",
  support: "Suporte",
  financial: "Financeiro",
  sales: "Vendas",
  sdr: "SDR",
  copilot: "Copiloto",
  analytics: "Analytics",
};

export default function AgentActivity() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>("7d");

  const dateRange = useMemo(() => getDateRange(preset), [preset]);
  const { agent, kpis, conversations, recentMessages, auditLog, isLoading } =
    useAgentActivity(id ?? "", dateRange);

  if (isLoading && !agent) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-container"><div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/agents")}
            aria-label="Voltar para agentes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: agent?.color ?? "#10293F" }}
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#10293F] dark:text-white">
              {agent?.name ?? "Agente"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs">
                {specialtyLabels[agent?.specialty ?? ""] ?? agent?.specialty}
              </Badge>
              <Badge
                className={cn(
                  "text-xs",
                  agent?.is_active
                    ? "bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30"
                    : "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30"
                )}
              >
                {agent?.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["today", "7d", "30d"] as Preset[]).map((p) => (
            <Button
              key={p}
              variant={preset === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPreset(p)}
              className={cn(
                "text-xs h-8",
                preset === p &&
                  "bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] shadow-none"
              )}
            >
              {p === "today" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Conversas"
          value={kpis.totalConversations.toString()}
        />
        <KpiCard
          icon={<Zap className="h-5 w-5" />}
          label="Resolucao IA"
          value={`${(kpis.aiResolvedRate * 100).toFixed(0)}%`}
          color={kpis.aiResolvedRate >= 0.7 ? "#16A34A" : kpis.aiResolvedRate >= 0.4 ? "#FFB800" : "#DC2626"}
        />
        <KpiCard
          icon={<Brain className="h-5 w-5" />}
          label="Confianca Media"
          value={`${(kpis.avgConfidence * 100).toFixed(0)}%`}
          color={kpis.avgConfidence >= 0.8 ? "#16A34A" : kpis.avgConfidence >= 0.6 ? "#FFB800" : "#DC2626"}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Custo Total"
          value={`$${kpis.totalCost.toFixed(4)}`}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          {conversations.length === 0 ? (
            <EmptyState message="Nenhuma conversa encontrada neste periodo." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titulo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IA</TableHead>
                      <TableHead>Duracao</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/kanban/support`)}
                      >
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {c.title || "Sem titulo"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-xs",
                              c.ai_resolved
                                ? "bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30"
                                : "bg-[#F5F5F5] text-[#666] border-[#E5E5E5]"
                            )}
                          >
                            {c.ai_resolved ? "Sim" : "Nao"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDuration(c.resolution_time_seconds)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatRelativeTime(c.started_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages">
          {recentMessages.length === 0 ? (
            <EmptyState message="Nenhuma mensagem encontrada neste periodo." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Confianca</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Tools</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMessages.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-xs",
                              m.role === "assistant"
                                ? "bg-[#E8F9F9] text-[#10293F] border-[#45E5E5]/40"
                                : "bg-[#F5F5F5] text-[#666] border-[#E5E5E5]"
                            )}
                          >
                            {m.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ConfidenceDisplay value={m.confidence} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.cost_usd != null ? `$${m.cost_usd.toFixed(6)}` : "-"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          {m.tools_used?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {m.tools_used.map((t, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.intent ?? "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(m.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audit">
          {auditLog.length === 0 ? (
            <EmptyState message="Nenhum registro de auditoria encontrado neste periodo." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acao</TableHead>
                      <TableHead>Guardrails</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Confianca</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm font-medium">
                          {a.action_taken ?? "-"}
                        </TableCell>
                        <TableCell>
                          {a.guardrails_triggered?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {a.guardrails_triggered.map((g, i) => (
                                <Badge
                                  key={i}
                                  className="text-[10px] px-1.5 py-0 bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/50"
                                >
                                  {g}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.response_time_ms != null ? `${a.response_time_ms}ms` : "-"}
                        </TableCell>
                        <TableCell>
                          <ConfidenceDisplay value={a.confidence_score} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(a.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div></div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center text-[#10293F]">
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p
              className="text-2xl font-bold font-[Poppins]"
              style={{ color: color ?? "#10293F" }}
            >
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "open";
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    open: { bg: "#E8F9F9", text: "#10293F", border: "#45E5E5", label: "Aberto" },
    in_progress: { bg: "#EFF6FF", text: "#2563EB", border: "#2563EB", label: "Em andamento" },
    resolved: { bg: "#F0FDF4", text: "#16A34A", border: "#16A34A", label: "Resolvido" },
    closed: { bg: "#F5F5F5", text: "#666", border: "#E5E5E5", label: "Fechado" },
    waiting_client: { bg: "#FFFBEB", text: "#92400E", border: "#FFB800", label: "Aguardando" },
  };
  const style = map[s] ?? map.open;
  return (
    <Badge
      className="text-xs"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: `${style.border}50`,
      }}
    >
      {style.label}
    </Badge>
  );
}

function ConfidenceDisplay({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }
  const pct = (value * 100).toFixed(0);
  const color = value >= 0.8 ? "#16A34A" : value >= 0.6 ? "#FFB800" : "#DC2626";
  return (
    <span className="text-sm font-medium" style={{ color }}>
      {pct}%
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
