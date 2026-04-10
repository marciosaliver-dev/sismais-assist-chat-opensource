import type { Ticket, Message, AIClassification, AISuggestion } from "@/types/ticket";

export const mockTickets: Ticket[] = [
  {
    id: "1001",
    customerName: "Maria Silva",
    customerPhone: "+55 11 99999-1234",
    subject: "Problema com pedido",
    lastMessage: "Olá, preciso de ajuda com meu pedido",
    status: "open",
    priority: "high",
    assignee: "João Atendente",
    unreadCount: 3,
    createdAt: "2024-01-15T10:30:00",
    updatedAt: "2 min",
    channel: "whatsapp",
    tags: ["pedido", "urgente"],
    module: "Vendas",
    type: "Reclamação",
  },
  {
    id: "1002",
    customerName: "João Santos",
    customerPhone: "+55 21 98888-5678",
    subject: "Dúvida sobre entrega",
    lastMessage: "Quando chega minha encomenda?",
    status: "in_progress",
    priority: "medium",
    assignee: "Ana Suporte",
    unreadCount: 0,
    createdAt: "2024-01-15T09:15:00",
    updatedAt: "15 min",
    channel: "whatsapp",
    tags: ["entrega"],
    module: "Logística",
    type: "Dúvida",
  },
  {
    id: "1003",
    customerName: "Ana Costa",
    customerPhone: "+55 31 97777-9012",
    subject: "Agradecimento",
    lastMessage: "Obrigada pelo atendimento!",
    status: "resolved",
    priority: "low",
    unreadCount: 0,
    createdAt: "2024-01-15T08:00:00",
    updatedAt: "1h",
    channel: "whatsapp",
    module: "Suporte",
    type: "Feedback",
  },
  {
    id: "1004",
    customerName: "Pedro Lima",
    customerPhone: "+55 41 96666-3456",
    subject: "Troca de produto",
    lastMessage: "Preciso trocar meu produto",
    status: "pending",
    priority: "medium",
    assignee: "João Atendente",
    unreadCount: 1,
    createdAt: "2024-01-15T07:30:00",
    updatedAt: "2h",
    channel: "whatsapp",
    tags: ["troca"],
    module: "Pós-venda",
    type: "Solicitação",
  },
  {
    id: "1005",
    customerName: "Carla Mendes",
    customerPhone: "+55 51 95555-7890",
    subject: "Erro no sistema",
    lastMessage: "Não consigo acessar minha conta",
    status: "open",
    priority: "urgent",
    unreadCount: 5,
    createdAt: "2024-01-15T11:00:00",
    updatedAt: "1 min",
    channel: "whatsapp",
    tags: ["erro", "acesso"],
    module: "Técnico",
    type: "Bug",
  },
];

export const mockMessages: Record<string, Message[]> = {
  "1001": [
    { id: "1", ticketId: "1001", content: "Olá, preciso de ajuda com meu pedido", sender: "customer", timestamp: "14:30" },
    { id: "2", ticketId: "1001", content: "Olá Maria! Claro, em que posso ajudar?", sender: "agent", senderName: "João", timestamp: "14:31" },
    { id: "3", ticketId: "1001", content: "Meu pedido #12345 está atrasado, deveria ter chegado ontem", sender: "customer", timestamp: "14:32" },
    { id: "4", ticketId: "1001", content: "Entendo sua preocupação. Deixe-me verificar o status do seu pedido.", sender: "agent", senderName: "João", timestamp: "14:33" },
  ],
  "1002": [
    { id: "1", ticketId: "1002", content: "Boa tarde! Quando chega minha encomenda?", sender: "customer", timestamp: "10:15" },
    { id: "2", ticketId: "1002", content: "Olá João! Vou verificar o rastreio para você.", sender: "agent", senderName: "Ana", timestamp: "10:20" },
  ],
};

export const mockAIClassification: AIClassification = {
  subject: "Atraso na entrega",
  type: "Reclamação",
  module: "Logística",
  priority: "high",
  confidence: 0.92,
};

export const mockAISuggestions: AISuggestion[] = [
  {
    id: "1",
    type: "response",
    content: "Maria, verifiquei e seu pedido #12345 está em trânsito. A previsão de entrega atualizada é para amanhã até às 18h. Peço desculpas pelo atraso.",
    confidence: 0.95,
  },
  {
    id: "2",
    type: "action",
    content: "Sugerir cupom de desconto de 10% para compensar o atraso na entrega.",
    confidence: 0.82,
  },
  {
    id: "3",
    type: "insight",
    content: "Cliente frequente (5 pedidos nos últimos 3 meses). Histórico de satisfação alto.",
    confidence: 0.88,
  },
];

export const mockAgents = [
  { id: "1", name: "João Atendente", email: "joao@sismais.com", role: "Atendente" },
  { id: "2", name: "Ana Suporte", email: "ana@sismais.com", role: "Atendente" },
  { id: "3", name: "Carlos Admin", email: "carlos@sismais.com", role: "Administrador" },
];

