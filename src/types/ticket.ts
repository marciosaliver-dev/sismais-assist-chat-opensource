export type TicketStatus = "open" | "in_progress" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketChannel = "whatsapp";

export interface Ticket {
  id: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  lastMessage: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  channel: TicketChannel;
  tags?: string[];
  module?: string;
  type?: string;
}

export interface Message {
  id: string;
  ticketId: string;
  content: string;
  sender: "customer" | "agent";
  senderName?: string;
  timestamp: string;
  attachments?: string[];
}

export interface AIClassification {
  subject: string;
  type: string;
  module: string;
  priority: TicketPriority;
  confidence: number;
}

export interface AISuggestion {
  id: string;
  type: "response" | "action" | "insight";
  content: string;
  confidence: number;
}
