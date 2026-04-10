import { X, Phone, Mail, Star, Ban, Trash2, Image, FileText, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { UazapiChat } from "@/hooks/useUazapiChats";

interface ContactInfoPanelProps {
  chat: UazapiChat;
  onClose: () => void;
}

export function ContactInfoPanel({ chat, onClose }: ContactInfoPanelProps) {
  return (
    <div className="w-[360px] border-l border-border bg-card h-full flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
          <X className="w-5 h-5" />
        </Button>
        <h3 className="font-medium text-foreground">Dados do contato</h3>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Avatar + name */}
        <div className="py-8 flex flex-col items-center text-center">
          <Avatar className="w-24 h-24 mb-4">
            <AvatarImage src={chat.contact_picture_url || undefined} />
            <AvatarFallback className="bg-secondary text-2xl">
              {(chat.contact_name || chat.contact_phone || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-semibold text-foreground">
            {chat.contact_name || "Sem nome"}
          </h2>
          <p className="text-sm text-muted-foreground">{chat.contact_phone || chat.chat_id}</p>
        </div>

        <Separator />

        {/* Quick info */}
        <div className="p-4 space-y-3">
          {chat.contact_phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{chat.contact_phone}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Media / Docs / Links placeholder */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Mídia, docs e links</h4>
          <div className="grid grid-cols-3 gap-2">
            <button className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-smooth">
              <Image className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Mídia</span>
            </button>
            <button className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-smooth">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Docs</span>
            </button>
            <button className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-smooth">
              <Link className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Links</span>
            </button>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-smooth">
            <Ban className="w-4 h-4" />
            Bloquear contato
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-smooth">
            <Trash2 className="w-4 h-4" />
            Apagar conversa
          </button>
        </div>
      </div>
    </div>
  );
}
