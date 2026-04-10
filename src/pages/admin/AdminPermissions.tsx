import { Check, X, Shield } from "lucide-react";
import { rolePermissions, roleLabels, type UserRole, type RolePermissions } from "@/types/auth";

interface Permission {
  id: keyof RolePermissions;
  name: string;
  description: string;
  category: string;
}

const permissions: Permission[] = [
  // Tickets
  { id: "viewAllTickets", name: "Ver todos os tickets", description: "Visualizar todos os tickets do sistema", category: "Tickets" },
  { id: "viewLeadTickets", name: "Ver tickets de leads", description: "Visualizar conversas de leads", category: "Tickets" },
  { id: "manageTickets", name: "Gerenciar tickets", description: "Criar, editar e atribuir tickets", category: "Tickets" },
  { id: "changeTicketStatus", name: "Alterar status", description: "Mudar status do ticket", category: "Tickets" },
  { id: "reopenTickets", name: "Reabrir tickets", description: "Reabrir tickets fechados", category: "Tickets" },
  // IA
  { id: "useAICopilot", name: "Usar IA Copiloto", description: "Acessar sugestões e análises da IA", category: "IA" },
  // Base de Conhecimento
  { id: "viewKnowledgeBase", name: "Ver base de conhecimento", description: "Acessar artigos e vídeos", category: "Base de Conhecimento" },
  { id: "viewFullKnowledgeBase", name: "Base completa", description: "Acesso total à base de conhecimento", category: "Base de Conhecimento" },
  { id: "manageKnowledgeBase", name: "Editar base", description: "Criar e editar artigos", category: "Base de Conhecimento" },
  // Admin
  { id: "manageUsers", name: "Gerenciar usuários", description: "Adicionar e remover usuários", category: "Administração" },
  { id: "manageSettings", name: "Configurações", description: "Alterar configurações do sistema", category: "Administração" },
  { id: "manageAgents", name: "Gerenciar agentes IA", description: "Configurar agentes de inteligência artificial", category: "Administração" },
  { id: "viewReports", name: "Ver relatórios", description: "Acessar relatórios e métricas", category: "Administração" },
  // Gestão
  { id: "manageCategories", name: "Gerenciar categorias", description: "Criar e editar categorias de tickets", category: "Gestão" },
  { id: "manageModules", name: "Gerenciar módulos", description: "Criar e editar módulos do sistema", category: "Gestão" },
  { id: "manageMacros", name: "Gerenciar macros", description: "Criar e editar respostas rápidas", category: "Gestão" },
  { id: "manageServiceCatalog", name: "Catálogo de serviços", description: "Gerenciar catálogo de serviços", category: "Gestão" },
];

const roles: UserRole[] = ["admin", "lider", "suporte", "comercial"];

const categoryOrder = ["Tickets", "IA", "Base de Conhecimento", "Administração", "Gestão"];

export default function AdminPermissions() {
  const groupedPermissions = categoryOrder.map(cat => ({
    category: cat,
    items: permissions.filter(p => p.category === cat),
  }));

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permissões</h1>
          <p className="text-muted-foreground">Permissões por função — {permissions.length} permissões, {roles.length} papéis</p>
        </div>

        {/* Permissions Matrix */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Permissão
                </th>
                {roles.map((role) => (
                  <th
                    key={role}
                    className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      {roleLabels[role]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedPermissions.map(group => (
                <>
                  <tr key={`cat-${group.category}`}>
                    <td colSpan={roles.length + 1} className="px-4 py-2 bg-muted/20">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.category}
                      </span>
                    </td>
                  </tr>
                  {group.items.map((permission) => (
                    <tr key={permission.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-foreground">{permission.name}</p>
                        <p className="text-xs text-muted-foreground">{permission.description}</p>
                      </td>
                      {roles.map((role) => (
                        <td key={role} className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            {rolePermissions[role][permission.id] ? (
                              <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                                <Check className="w-4 h-4 text-success" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <X className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Info */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
          <p>
            <strong>Nota:</strong> No MVP, as permissões são fixas por função.
            Funcionalidades de permissões personalizadas serão adicionadas em versões futuras.
          </p>
        </div>
      </div>
    </div>
  );
}
