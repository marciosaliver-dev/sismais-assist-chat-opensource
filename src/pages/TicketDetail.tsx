import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ConversationHeader } from "@/components/conversation/ConversationHeader";
import { MessageList } from "@/components/conversation/MessageList";
import { MessageInput } from "@/components/conversation/MessageInput";
import { AIPanel } from "@/components/copilot/AIPanel";
import { mockTickets, mockMessages, mockAgents, mockAIClassification, mockAISuggestions } from "@/data/mockData";
import type { Ticket, Message, TicketStatus, AISuggestion } from "@/types/ticket";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);

  useEffect(() => {
    const foundTicket = mockTickets.find(t => t.id === id);
    if (foundTicket) {
      setTicket(foundTicket);
      setMessages(mockMessages[id || ""] || []);
    } else {
      navigate("/");
    }
  }, [id, navigate]);

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const handleStatusChange = (status: TicketStatus) => {
    setTicket({ ...ticket, status });
  };

  const handleAssigneeChange = (assignee: string) => {
    setTicket({ ...ticket, assignee: assignee || undefined });
  };

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: String(messages.length + 1),
      ticketId: ticket.id,
      content,
      sender: "agent",
      senderName: "Você",
      timestamp: new Date().toLocaleTimeString("pt-BR", { 
        hour: "2-digit", 
        minute: "2-digit" 
      }),
    };
    setMessages([...messages, newMessage]);
    setPendingMessage("");
  };

  const handleUseSuggestion = (suggestion: AISuggestion) => {
    if (suggestion.type === "response") {
      setPendingMessage(suggestion.content);
    }
  };

  const handleRefreshAI = () => {
    setIsAILoading(true);
    setTimeout(() => setIsAILoading(false), 1500);
  };

  const summary = "Cliente Maria Silva está reclamando sobre atraso na entrega do pedido #12345. O pedido deveria ter chegado ontem. Cliente demonstra frustração mas mantém tom educado.";

  return (
    <div className="flex h-full">
      {/* Conversation Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ConversationHeader
          ticket={ticket}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
          agents={mockAgents}
        />
        <MessageList messages={messages} />
        <MessageInput 
          onSend={handleSendMessage} 
          initialValue={pendingMessage}
          key={pendingMessage} // Force re-render when suggestion is used
        />
      </div>

      {/* AI Panel */}
      <div className="w-80 shrink-0">
        <AIPanel
          summary={summary}
          classification={mockAIClassification}
          suggestions={mockAISuggestions}
          isLoading={isAILoading}
          onUseSuggestion={handleUseSuggestion}
          onRefresh={handleRefreshAI}
        />
      </div>
    </div>
  );
}
