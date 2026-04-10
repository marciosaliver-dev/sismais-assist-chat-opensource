import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSearch, TicketCheck, Clock, Star, AlertCircle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SortableHeader,
  SkeletonRows,
  TableEmptyState,
  SmartPagination,
  useSortable,
} from "@/components/layout/DataTableWrapper";
import { SearchBar, useSearchBar } from "@/components/layout/SearchBar";
import { PeriodSelector, usePeriodSelector } from "@/components/layout/PeriodSelector";
import { ReportKPICards, ReportKPI } from "@/components/reports/ReportKPICards";
import { ExportCSVButton } from "@/components/reports/ExportCSVButton";
import { TicketFilters } from "@/components/reports/TicketFilters";
import { TicketDetailSheet } from "@/components/reports/TicketDetailSheet";
import { ReportsLayout } from "@/components/reports/ReportsLayout";
import {
  useTicketReport,
  useTicketReportKPIs,
  fetchAllTicketsForExport,
  TicketReportFilters,
  TicketRow,
} from "@/hooks/useTicketReport";

const PAGE_SIZE = 25;

const CSV_COLUMNS = [
  { key: "ticket_number", label: "#Ticket" },
  { key: "assunto", label: "Assunto" },
  { key: "cliente", label: "Cliente" },
  { key: "status", label: "Status" },
  { key: "prioridade", label: "Prioridade" },
  { key: "tipo", label: "Tipo" },
  { key: "ia_resolvido", label: "IA Resolvido" },
  { key: "csat", label: "CSAT" },
  { key: "tempo_resolucao_min", label: "Tempo (min)" },
  { key: "inicio", label: "Início" },
  { key: "resolvido_em", label: "Resolvido em" },
  { key: "categoria", label: "Categoria" },
  { key: "agente_humano", label: "Agente Humano" },
  { key: "agente_ia", label: "Agente IA" },
];

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function priorityBadge(priority: string | null) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    critica: { bg: "bg-purple-50", text: "text-[#7C3AED]", border: "border-purple-200" },
    alta: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", border: "border-red-200" },
    media: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-yellow-200" },
    baixa: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-green-200" },
  };
  if (!priority) return <span className="text-muted-foreground">—</span>;
  const s = map[priority] || { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${s.bg} ${s.text} ${s.border}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function statusBadge(status: string | null) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    aberto: { bg: "bg-[#E8F9F9]", text: "text-[#10293F]", border: "border-[rgba(69,229,229,0.4)]", label: "Aberto" },
    em_atendimento: { bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", border: "border-blue-200", label: "Em Atendimento" },
    aguardando: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[rgba(255,184,0,0.5)]", label: "Aguardando" },
    finalizado: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-green-200", label: "Finalizado" },
    resolvido: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-green-200", label: "Resolvido" },
    cancelado: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", border: "border-red-200", label: "Cancelado" },
  };
  const s = map[status || ""] || { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: status || "—" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

export default function TicketReport() {
  const [searchParams] = useSearchParams();
  const initialClientId = searchParams.get("client") || "";

  const { period, setPeriod } = usePeriodSelector("last30");
  const [searchValue, debouncedSearch, setSearchValue] = useSearchBar(400);
  const { sortField, sortDirection, handleSort } = useSortable("started_at", "desc");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);

  const [filterState, setFilterState] = useState({
    status: "",
    priority: "",
    categoryId: "",
    moduleId: "",
    humanAgentId: "",
    aiAgentId: "",
    boardId: "",
    clientId: initialClientId,
  });

  const filters: TicketReportFilters = {
    period,
    search: debouncedSearch,
    ...filterState,
  };

  const handleFilterChange = useCallback((partial: Partial<TicketReportFilters>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterState({
      status: "", priority: "", categoryId: "", moduleId: "",
      humanAgentId: "", aiAgentId: "", boardId: "", clientId: "",
    });
    setPage(1);
  }, []);

  const { data, isLoading, isFetching } = useTicketReport({
    filters,
    page,
    pageSize: PAGE_SIZE,
    sortField,
    sortDirection,
  });

  const { data: kpis, isLoading: kpisLoading } = useTicketReportKPIs(filters);

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data?.total || 0);

  const kpiCards: ReportKPI[] = [
    {
      icon: FileSearch,
      title: "Total de Tickets",
      value: kpis?.total ?? 0,
      subtitle: `${kpis?.aiResolved ?? 0} resolvidos por IA`,
      accent: "cyan",
    },
    {
      icon: AlertCircle,
      title: "Em Aberto",
      value: kpis?.open ?? 0,
      accent: "yellow",
    },
    {
      icon: TicketCheck,
      title: "Resolvidos",
      value: kpis?.resolved ?? 0,
      accent: "success",
    },
    {
      icon: Star,
      title: "CSAT Médio",
      value: kpis?.avgCsat ? kpis.avgCsat.toFixed(1) : "—",
      subtitle: kpis?.avgResolution ? `Tempo médio: ${formatDuration(kpis.avgResolution)}` : undefined,
      accent: "navy",
    },
  ];

  return (
    <ReportsLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
            Relatório de Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pesquise, filtre e analise todos os atendimentos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            value={period}
            onChange={(v) => { setPeriod(v); setPage(1); }}
          />
          <ExportCSVButton
            getData={() => fetchAllTicketsForExport(filters)}
            columns={CSV_COLUMNS}
            filename="tickets"
          />
        </div>
      </div>

      {/* KPIs */}
      <ReportKPICards kpis={kpiCards} loading={kpisLoading} />

      {/* Search + Filters */}
      <div className="space-y-3">
        <SearchBar
          value={searchValue}
          onChange={(v) => { setSearchValue(v); setPage(1); }}
          placeholder="Buscar por assunto, cliente ou telefone..."
          className="max-w-md"
        />
        <TicketFilters
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
        <div className={`overflow-x-auto transition-opacity duration-200 ${isFetching && !isLoading ? "opacity-60" : ""}`}>
          <Table className="stagger-rows">
            <TableHeader>
              <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
                <SortableHeader label="#" field="ticket_number" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-16 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Assunto" field="ticket_subject" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Cliente" field="customer_name" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Status" field="status" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-32 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Prioridade" field="priority" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-28 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Categoria" field="ticket_category_id" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-28 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Agente" field="handler_type" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-32 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="CSAT" field="csat_score" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-16 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Resolução" field="resolution_seconds" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-24 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
                <SortableHeader label="Data" field="started_at" currentField={sortField} currentDirection={sortDirection} onSort={(f) => { handleSort(f); setPage(1); }} className="w-28 text-white/80 text-[11px] uppercase tracking-wider font-semibold" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows count={10} columns={10} />
              ) : !data?.rows.length ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <TableEmptyState
                      icon={<FileSearch className="w-12 h-12 text-muted-foreground/30" />}
                      message="Nenhum ticket encontrado para os filtros selecionados"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-muted/50 transition-colors border-b border-border/50"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{ticket.ticket_number}
                    </TableCell>
                    <TableCell className="font-medium text-[13px] max-w-[200px] truncate text-[#10293F] dark:text-foreground">
                      {ticket.ticket_subject || "Sem assunto"}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {ticket.customer_name || ticket.customer_phone}
                    </TableCell>
                    <TableCell>{statusBadge(ticket.status)}</TableCell>
                    <TableCell>{priorityBadge(ticket.priority)}</TableCell>
                    <TableCell className="text-[13px]">
                      {ticket.category_name ? (
                        <span className="inline-flex items-center gap-1.5">
                          {ticket.category_color && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ticket.category_color }} />
                          )}
                          {ticket.category_name}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {ticket.handler_type === "ai" ? (
                        <span className="inline-flex items-center gap-1 text-[#45E5E5] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#45E5E5]" />
                          IA
                        </span>
                      ) : ticket.human_agent_name ? (
                        ticket.human_agent_name
                      ) : ticket.agent_name ? (
                        <span className="text-[#45E5E5]">{ticket.agent_name}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {ticket.csat_score ? (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-[#FFB800] fill-[#FFB800]" />
                          <span className="font-medium">{ticket.csat_score}</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(ticket.resolution_seconds)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {ticket.started_at
                        ? new Date(ticket.started_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="px-4 py-3 border-t border-border bg-card">
            <SmartPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              showInfo
              from={from}
              to={to}
              total={data?.total || 0}
            />
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <TicketDetailSheet
        ticket={selectedTicket}
        open={!!selectedTicket}
        onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}
      />
    </ReportsLayout>
  );
}
