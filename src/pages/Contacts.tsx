import { useState, useEffect } from "react";
import { Contact, Search, MessageSquare, Users2, ExternalLink, VolumeX, Camera, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { useContacts } from "@/hooks/useContacts";
import { useContactAvatarBatch } from "@/hooks/useContactAvatarBatch";
import { Spinner } from "@/components/ui/spinner";
import { WhatsAppInstanceSelect } from "@/components/shared/WhatsAppInstanceSelect";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { UazapiChat } from "@/hooks/useUazapiChats";

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const cleaned = phone.replace(/@s\.whatsapp\.net$|@g\.us$|@lid$/gi, "");
  // If contains letters (internal ID like lid), hide it
  if (/[a-zA-Z]/.test(cleaned)) return "—";
  const digits = cleaned.replace(/\D/g, "");
  if (!digits || digits.length < 8) return "—";
  // Format BR phone: +55 (XX) XXXXX-XXXX
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return digits;
}

function ContactRow({
  contact,
  isGroup,
  onToggleIgnore,
  isToggling,
  batchAvatarUrl,
}: {
  contact: UazapiChat & { is_ignored?: boolean };
  isGroup: boolean;
  onToggleIgnore: (chatId: string, currentIgnored: boolean) => void;
  isToggling: boolean;
  batchAvatarUrl?: string | null;
}) {
  const isIgnored = contact.is_ignored === true;
  const pictureUrl = contact.contact_picture_url || batchAvatarUrl || null;

  return (
    <TableRow className={`transition-opacity ${isIgnored ? "opacity-50" : ""}`}>
      <TableCell>
        <Avatar className="w-9 h-9">
          <AvatarImage src={pictureUrl || undefined} />
          <AvatarFallback className="text-xs bg-muted">
            {(contact.contact_name || contact.contact_phone || "?").substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[200px]">
            {contact.contact_name || formatPhone(contact.contact_phone) || "Sem nome"}
          </span>
          {isGroup && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              Grupo
            </Badge>
          )}
          {contact.is_pinned && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              Fixado
            </Badge>
          )}
          {isIgnored && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 gap-0.5">
              <VolumeX className="w-3 h-3" />
              Ignorado
            </Badge>
          )}
        </div>
      </TableCell>
      {!isGroup && (
        <TableCell className="text-muted-foreground text-sm">
          {formatPhone(contact.contact_phone)}
        </TableCell>
      )}
      <TableCell className="text-muted-foreground text-sm truncate max-w-[250px]">
        {contact.last_message_preview || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {contact.last_message_time
          ? format(new Date(contact.last_message_time), "dd/MM/yy HH:mm", { locale: ptBR })
          : "—"}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={isIgnored}
          onCheckedChange={() => onToggleIgnore(contact.id, isIgnored)}
          disabled={isToggling}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href="/kanban/support" title="Abrir conversa">
            <MessageSquare className="w-4 h-4" />
          </a>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows({ count, isGroup }: { count: number; isGroup: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="w-9 h-9 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          {!isGroup && <TableCell><Skeleton className="h-4 w-28" /></TableCell>}
          <TableCell><Skeleton className="h-4 w-44" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function SortableHeader({ label, field, currentField, currentDirection, onSort }: {
  label: string;
  field: string;
  currentField: string;
  currentDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const isActive = currentField === field;
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

function ContactsTable({ isGroup, search, instanceId, onCountChange }: { isGroup: boolean; search: string; instanceId?: string; onCountChange?: (count: number) => void }) {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState("last_message_time");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { contacts, totalCount, isLoading, isFetching, toggleIgnore, pageSize } = useContacts(isGroup, search, instanceId, page, sortField, sortDirection);
  const avatarMap = useContactAvatarBatch(contacts);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    onCountChange?.(totalCount);
  }, [totalCount, onCountChange]);

  const handleToggleIgnore = (chatId: string, currentIgnored: boolean) => {
    toggleIgnore.mutate(
      { chatId, ignored: !currentIgnored },
      {
        onSuccess: () => {
          toast.success(!currentIgnored ? "Contato marcado como ignorado" : "Contato removido da lista de ignorados");
        },
        onError: () => {
          toast.error("Erro ao atualizar status");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        {isGroup ? <Users2 className="w-10 h-10" /> : <Contact className="w-10 h-10" />}
        <p className="text-sm">
          {search
            ? "Nenhum resultado encontrado"
            : isGroup
            ? "Nenhum grupo encontrado"
            : "Nenhum contato encontrado"}
        </p>
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`flex-1 overflow-auto border rounded-lg min-h-0 transition-opacity duration-200 ${isFetching ? "opacity-60" : ""}`}>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_3px_0_hsl(var(--border)/0.4)]">
            <TableRow>
              <TableHead className="w-12" />
              <SortableHeader label="Nome" field="contact_name" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />
              {!isGroup && <SortableHeader label="Telefone" field="contact_phone" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />}
              <SortableHeader label="Última mensagem" field="last_message_preview" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Data" field="last_message_time" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <TableHead className="w-24 text-center">Ignorar</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => {
              const phone = c.contact_phone?.replace(/@.+$/, "").replace(/\D/g, "") || "";
              return (
                <ContactRow
                  key={c.id}
                  contact={c}
                  isGroup={isGroup}
                  onToggleIgnore={handleToggleIgnore}
                  isToggling={toggleIgnore.isPending}
                  batchAvatarUrl={avatarMap.get(phone)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="shrink-0 pt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {from}–{to} de {totalCount}
        </p>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {getPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <PaginationItem key={`e-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === page}
                      onClick={() => setPage(p)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [contactCount, setContactCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [syncingPhotos, setSyncingPhotos] = useState(false);

  const handleSyncPhotos = async () => {
    setSyncingPhotos(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-contact", {
        body: { action: "batch", limit: 30 },
      });
      if (error) throw error;
      toast.success(`Fotos sincronizadas: ${data?.enriched || 0} de ${data?.total || 0} contatos`);
    } catch {
      toast.error("Erro ao sincronizar fotos");
    } finally {
      setSyncingPhotos(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Contatos e grupos do WhatsApp
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSyncPhotos}
              disabled={syncingPhotos}
              className="h-9 w-9"
            >
              <Camera className={`w-4 h-4 ${syncingPhotos ? "animate-pulse" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sincronizar fotos de perfil</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-end gap-3 shrink-0">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppInstanceSelect
            value={selectedInstance}
            onChange={setSelectedInstance}
            label="Instância"
            className="w-56"
          />
          {selectedInstance && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSelectedInstance("")}
              title="Limpar filtro"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="contacts" className="flex-1 flex flex-col overflow-hidden min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="contacts" className="gap-1.5">
            <Contact className="w-4 h-4" />
            Contatos
            {contactCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 min-w-[20px] text-center">
                {contactCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <Users2 className="w-4 h-4" />
            Grupos
            {groupCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 min-w-[20px] text-center">
                {groupCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="flex-1 overflow-hidden mt-4">
          <ContactsTable isGroup={false} search={search} instanceId={selectedInstance || undefined} onCountChange={setContactCount} />
        </TabsContent>
        <TabsContent value="groups" className="flex-1 overflow-hidden mt-4">
          <div className="mb-3 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm shrink-0">
            <ExternalLink className="w-4 h-4 shrink-0" />
            Mensagens de grupos não geram tickets no sistema de atendimento.
          </div>
          <ContactsTable isGroup={true} search={search} instanceId={selectedInstance || undefined} onCountChange={setGroupCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
