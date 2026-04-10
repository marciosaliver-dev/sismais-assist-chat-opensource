import { useState } from "react";
import { Search, Pin, Volume2, VolumeX, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useContactPicture } from "@/hooks/useContactPicture";
import type { UazapiChat } from "@/hooks/useUazapiChats";

interface ChatSidebarProps {
  chats: UazapiChat[];
  selectedChatId: string | null;
  onSelectChat: (chat: UazapiChat) => void;
  isLoading: boolean;
  instanceId?: string;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy");
}

function MessageStatus({ fromMe, status }: { fromMe: boolean | null; status?: string }) {
  if (!fromMe) return null;
  switch (status) {
    case "read": return <span className="text-blue-400 text-xs">✓✓</span>;
    case "delivered": return <span className="text-muted-foreground text-xs">✓✓</span>;
    case "sent": return <span className="text-muted-foreground text-xs">✓</span>;
    default: return <span className="text-muted-foreground text-xs">⏳</span>;
  }
}

export function ChatSidebar({ chats, selectedChatId, onSelectChat, isLoading, instanceId }: ChatSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = chats.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.contact_name?.toLowerCase().includes(q) ?? false) ||
      (c.contact_phone?.includes(q) ?? false) ||
      (c.last_message_preview?.toLowerCase().includes(q) ?? false)
    );
  });

  const pinned = filtered.filter((c) => c.is_pinned);
  const recent = filtered.filter((c) => !c.is_pinned);

  return (
    <div className="w-[320px] border-r border-border flex flex-col bg-card h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ou começar nova conversa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-none text-sm"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && (
          <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
          </div>
        )}

        {pinned.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
              <Pin className="w-3 h-3" /> Fixadas
            </div>
            {pinned.map((chat) => (
              <ChatItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={() => onSelectChat(chat)} instanceId={instanceId} />
            ))}
          </>
        )}

        {recent.length > 0 && (
          <>
            {pinned.length > 0 && (
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Recentes</div>
            )}
            {recent.map((chat) => (
              <ChatItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={() => onSelectChat(chat)} instanceId={instanceId} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ChatItem({ chat, selected, onSelect, instanceId }: { chat: UazapiChat; selected: boolean; onSelect: () => void; instanceId?: string }) {
  const { url: pictureUrl } = useContactPicture(chat.id, chat.chat_id, instanceId, chat.contact_picture_url);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-smooth text-left",
        selected && "bg-accent"
      )}
    >
      <Avatar className="w-12 h-12 shrink-0">
        <AvatarImage src={pictureUrl || undefined} />
        <AvatarFallback className="bg-secondary text-foreground text-sm">
          {(chat.contact_name || chat.contact_phone || "?")[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-foreground truncate flex items-center gap-1">
            {chat.contact_name || chat.contact_phone || chat.chat_id}
            {(chat as any).is_ignored && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <EyeOff className="w-3.5 h-3.5 text-destructive shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Ignorado</TooltipContent>
              </Tooltip>
            )}
          </span>
          <span className={cn("text-xs shrink-0", chat.unread_count > 0 ? "text-[hsl(var(--whatsapp))]" : "text-muted-foreground")}>
            {formatTime(chat.last_message_time)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <MessageStatus fromMe={chat.last_message_from_me} />
            {chat.last_message_preview || "..."}
          </p>
          {chat.unread_count > 0 && (
            <Badge className="whatsapp-badge text-xs h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5">
              {chat.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
