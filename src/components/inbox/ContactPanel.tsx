import { useState } from "react";
import { 
  User, Mail, Phone, Building2, MapPin, 
  Facebook, Twitter, Linkedin, ChevronDown, ChevronUp,
  MessageSquare, Tag, Clock, Calendar, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";
import { AIPanel } from "@/components/copilot/AIPanel";
import type { AIClassification, AISuggestion } from "@/types/ticket";

interface ContactPanelProps {
  ticket: Ticket;
  summary?: string;
  classification?: AIClassification;
  suggestions: AISuggestion[];
  isAILoading?: boolean;
  onUseSuggestion: (suggestion: AISuggestion) => void;
  onRefresh: () => void;
}

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({ title, icon, defaultOpen = false, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {title}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

export function ContactPanel({
  ticket,
  summary,
  classification,
  suggestions,
  isAILoading,
  onUseSuggestion,
  onRefresh,
}: ContactPanelProps) {
  const [activeTab, setActiveTab] = useState<"contact" | "copilot">("contact");

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("contact")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors relative",
            activeTab === "contact"
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Contato
          {activeTab === "contact" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("copilot")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors relative",
            activeTab === "copilot"
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Copiloto
          {activeTab === "copilot" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === "contact" ? (
          <div className="animate-fade-in">
            {/* Contact Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-whatsapp flex items-center justify-center text-primary-foreground font-semibold text-xl">
                  {ticket.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{ticket.customerName}</h3>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">
                  {ticket.customerName.toLowerCase().replace(" ", ".")}@email.com
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{ticket.customerPhone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">Empresa XYZ</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">São Paulo, Brasil</span>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-2 pt-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Facebook className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Twitter className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Linkedin className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Accordion Sections */}
            <AccordionSection
              title="Ações da Conversa"
              icon={<MessageSquare className="w-4 h-4" />}
              defaultOpen
            >
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Tag className="w-4 h-4 mr-2" />
                  Adicionar tag
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Atribuir para equipe
                </Button>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Informações do Ticket"
              icon={<Tag className="w-4 h-4" />}
              defaultOpen
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ID do Ticket</p>
                  <p className="text-sm font-medium text-foreground">#{ticket.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Assunto</p>
                  <p className="text-sm text-foreground">{ticket.subject}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Prioridade</p>
                  <Badge variant="outline" className="capitalize">
                    {ticket.priority === "urgent" ? "Urgente" :
                     ticket.priority === "high" ? "Alta" :
                     ticket.priority === "medium" ? "Média" : "Baixa"}
                  </Badge>
                </div>
                {ticket.tags && ticket.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {ticket.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionSection>

            <AccordionSection
              title="Conversas Anteriores"
              icon={<Clock className="w-4 h-4" />}
            >
              <div className="text-sm text-muted-foreground">
                <p>3 conversas anteriores</p>
                <p className="text-xs mt-1">Última: 15/01/2024</p>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Atributos do Contato"
              icon={<User className="w-4 h-4" />}
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente desde</span>
                  <span className="text-foreground">Mar 2023</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de compras</span>
                  <span className="text-foreground">R$ 2.450,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedidos</span>
                  <span className="text-foreground">5</span>
                </div>
              </div>
            </AccordionSection>
          </div>
        ) : (
          <AIPanel
            summary={summary}
            classification={classification}
            suggestions={suggestions}
            isLoading={isAILoading}
            onUseSuggestion={onUseSuggestion}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
}
