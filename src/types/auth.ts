export type UserRole = "admin" | "lider" | "suporte" | "comercial";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
}

export interface RolePermissions {
  // Tickets
  viewAllTickets: boolean;
  viewLeadTickets: boolean;
  manageTickets: boolean;
  changeTicketStatus: boolean;
  reopenTickets: boolean;

  // AI
  useAICopilot: boolean;

  // Knowledge Base
  viewKnowledgeBase: boolean;
  viewFullKnowledgeBase: boolean;
  manageKnowledgeBase: boolean;

  // Admin
  manageUsers: boolean;
  manageSettings: boolean;
  manageAgents: boolean;
  viewReports: boolean;

  // Gestão (Líder)
  manageCategories: boolean;
  manageModules: boolean;
  manageMacros: boolean;
  manageServiceCatalog: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    viewAllTickets: true,
    viewLeadTickets: true,
    manageTickets: true,
    changeTicketStatus: true,
    reopenTickets: true,
    useAICopilot: true,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: true,
    manageKnowledgeBase: true,
    manageUsers: true,
    manageSettings: true,
    manageAgents: true,
    viewReports: true,
    manageCategories: true,
    manageModules: true,
    manageMacros: true,
    manageServiceCatalog: true,
  },
  lider: {
    viewAllTickets: true,
    viewLeadTickets: false,
    manageTickets: true,
    changeTicketStatus: true,
    reopenTickets: false,
    useAICopilot: true,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: true,
    manageKnowledgeBase: true,
    manageUsers: false,
    manageSettings: false,
    manageAgents: false,
    viewReports: true,
    manageCategories: true,
    manageModules: true,
    manageMacros: true,
    manageServiceCatalog: true,
  },
  suporte: {
    viewAllTickets: true,
    viewLeadTickets: false,
    manageTickets: true,
    changeTicketStatus: true,
    reopenTickets: false,
    useAICopilot: true,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: true,
    manageKnowledgeBase: true,
    manageUsers: false,
    manageSettings: false,
    manageAgents: false,
    viewReports: true,
    manageCategories: false,
    manageModules: false,
    manageMacros: false,
    manageServiceCatalog: false,
  },
  comercial: {
    viewAllTickets: false,
    viewLeadTickets: true,
    manageTickets: false,
    changeTicketStatus: false,
    reopenTickets: false,
    useAICopilot: false,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: false,
    manageKnowledgeBase: false,
    manageUsers: false,
    manageSettings: false,
    manageAgents: false,
    viewReports: true,
    manageCategories: false,
    manageModules: false,
    manageMacros: false,
    manageServiceCatalog: false,
  },
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  lider: "Líder",
  suporte: "Suporte",
  comercial: "Comercial",
};
