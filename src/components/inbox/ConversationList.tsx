import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

interface ConversationListProps {
  tickets: Ticket[];
  selectedId?: string;
  onSelect: (ticketId: string) => void;
}

const tabs = [
  { id: "mine", label: "Meus", count: 3 },
  { id: "unassigned", label: "Não atribuídos", count: 2 },
  { id: "all", label: "Todos", count: 12 },
];

const statusColors: Record<string, string> = {
  open: "bg-status-open",
  in_progress: "bg-primary",
  pending: "bg-status-pending",
  resolved: "bg-status-resolved",
  closed: "bg-muted-foreground",
};

export function ConversationList({ tickets, selectedId, onSelect }: ConversationListProps) {
  const [activeTab, setActiveTab] = useState("mine");
  const [search, setSearch] = useState("");

  const filteredTickets = tickets.filter((ticket) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        ticket.customerName.toLowerCase().includes(searchLower) ||
        ticket.lastMessage.toLowerCase().includes(searchLower) ||
        ticket.subject.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversas
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-1.5 h-5 min-w-5 px-1.5 text-xs",
                activeTab === tab.id && "bg-primary/10 text-primary"
              )}
            >
              {tab.count}
            </Badge>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredTickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onSelect(ticket.id)}
            className={cn(
              "w-full p-3 text-left border-b border-border conv-card hover:bg-accent/50",
              selectedId === ticket.id && "bg-accent"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-whatsapp flex items-center justify-center text-primary-foreground font-medium text-sm">
                  {ticket.customerName.charAt(0).toUpperCase()}
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                  statusColors[ticket.status]
                )} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-medium text-sm text-foreground truncate">
                    {ticket.customerName}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {ticket.updatedAt}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs text-muted-foreground">
                    via WhatsApp
                  </span>
                </div>

                <p className="text-sm text-muted-foreground truncate">
                  {ticket.lastMessage}
                </p>

                {/* Tags */}
                {ticket.tags && ticket.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {ticket.tags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs h-4 px-1.5 bg-secondary/50"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Unread Badge */}
              {ticket.unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground h-5 min-w-5 px-1.5 text-xs shrink-0">
                  {ticket.unreadCount}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
