import { Suspense } from "react"
import { lazyRetry } from "@/lib/lazyRetry"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import type { RolePermissions } from "@/types/auth"
import { MainLayout } from "@/components/layout/MainLayout"
import { Spinner } from "@/components/ui/spinner"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { SetupWizard } from "@/components/SetupWizard/SetupWizard"

// Verifica se as variáveis de ambiente obrigatórias estão configuradas
const isConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

// Lazy-loaded pages
const Login = lazyRetry(() => import("./pages/Login"))
const Dashboard = lazyRetry(() => import("./pages/Dashboard"))
const Agents = lazyRetry(() => import("./pages/Agents"))

const Knowledge = lazyRetry(() => import("./pages/Knowledge"))
const WhatsAppPage = lazyRetry(() => import("./pages/WhatsApp"))
const Automations = lazyRetry(() => import("./pages/Automations"))
const AutomationEditor = lazyRetry(() => import("./pages/AutomationEditor"))
const FlowBuilder = lazyRetry(() => import("./pages/FlowBuilder"))
const Tickets = lazyRetry(() => import("./pages/Tickets"))
const KanbanPage = lazyRetry(() => import("./pages/KanbanPage"))
const WhatsAppInstances = lazyRetry(() => import("./pages/WhatsAppInstances"))
// HumanAgents page removed — unified into AdminUsers
const AIConsumptionDashboard = lazyRetry(() => import("./pages/AIConsumptionDashboard"))
const ApiLogs = lazyRetry(() => import("./pages/ApiLogs"))
const AgentPlayground = lazyRetry(() => import("./pages/AgentPlayground"))
const AgentBuilder = lazyRetry(() => import("./pages/AgentBuilder"))
const AgentActivity = lazyRetry(() => import("./pages/AgentActivity"))
const AutomationPlayground = lazyRetry(() => import("./pages/AutomationPlayground"))
const AISettings = lazyRetry(() => import("./pages/AISettings"))
const AITools = lazyRetry(() => import("./pages/AITools"))
const CTOAdvisor = lazyRetry(() => import("./pages/CTOAdvisor"))
const Clients = lazyRetry(() => import("./pages/Clients"))
const ClientDetail = lazyRetry(() => import("./pages/ClientDetail"))
const ClientDuplicates = lazyRetry(() => import("./pages/ClientDuplicates"))
const Customer360 = lazyRetry(() => import("./pages/Customer360"))
const GLSyncDashboard = lazyRetry(() => import("./pages/GLSyncDashboard"))
const NotFound = lazyRetry(() => import("./pages/NotFound"))
const Settings = lazyRetry(() => import("./pages/Settings"))

const Contacts = lazyRetry(() => import("./pages/Contacts"))
const Documentation = lazyRetry(() => import("./pages/Documentation"))
const Macros = lazyRetry(() => import("./pages/Macros"))
const Feriados = lazyRetry(() => import("./pages/Feriados"))
const ServiceCatalog = lazyRetry(() => import("./pages/ServiceCatalog"))
const AIConfigurator = lazyRetry(() => import("./pages/AIConfigurator"))
const Register = lazyRetry(() => import("./pages/Register"))
const Queue = lazyRetry(() => import("./pages/Queue"))
const PendingApproval = lazyRetry(() => import("./pages/PendingApproval"))
const AdminUsers = lazyRetry(() => import("./pages/admin/AdminUsers"))
const AdminPermissions = lazyRetry(() => import("./pages/admin/AdminPermissions"))
const AdminIntegrations = lazyRetry(() => import("./pages/admin/AdminIntegrations"))
const AdminApiKeys = lazyRetry(() => import("./pages/admin/AdminApiKeys"))
const WhatsAppIntegration = lazyRetry(() => import("./pages/admin/WhatsAppIntegration"))
const AdminAudit = lazyRetry(() => import("./pages/admin/AdminAudit"))
const HelpCenter = lazyRetry(() => import("./pages/HelpCenter"))
const AdminManuais = lazyRetry(() => import("./pages/AdminManuais"))
const AdminManualEditor = lazyRetry(() => import("./pages/AdminManualEditor"))
const WhatsAppTestPanel = lazyRetry(() => import("./pages/WhatsAppTestPanel"))
const Campaigns = lazyRetry(() => import("./pages/Campaigns"))
const Skills = lazyRetry(() => import("./pages/Skills"))
const HelpManuals = lazyRetry(() => import("./pages/HelpManuals"))
const HelpManualViewer = lazyRetry(() => import("./pages/HelpManualViewer"))
const HelpVideos = lazyRetry(() => import("./pages/HelpVideos"))
const HelpTickets = lazyRetry(() => import("./pages/HelpTickets"))
const HelpOpenTicket = lazyRetry(() => import("./pages/HelpOpenTicket"))
const HelpAIChat = lazyRetry(() => import("./pages/HelpAIChat"))
const HelpContent = lazyRetry(() => import("./pages/HelpContent"))
const HelpContentViewer = lazyRetry(() => import("./pages/HelpContentViewer"))
const HelpAdminDashboard = lazyRetry(() => import("./pages/admin/HelpAdminDashboard"))
const AdminHelpVideos = lazyRetry(() => import("./pages/admin/AdminHelpVideos"))
const AIBuilder = lazyRetry(() => import("./pages/AIBuilder"))
const Updates = lazyRetry(() => import("./pages/Updates"))
const Supervisor = lazyRetry(() => import("./pages/Supervisor"))
const Help = lazyRetry(() => import("./pages/Help"))
const WebhookBillingLogs = lazyRetry(() => import("./pages/WebhookBillingLogs"))
const Evaluations = lazyRetry(() => import("./pages/Evaluations"))
const Feedback = lazyRetry(() => import("./pages/Feedback"))
const TicketReport = lazyRetry(() => import("./pages/reports/TicketReport"))
const CompanyVolumeReport = lazyRetry(() => import("./pages/reports/CompanyVolumeReport"))
const ExecutiveDashboard = lazyRetry(() => import("./pages/reports/ExecutiveDashboard"))
const CancellationDashboard = lazyRetry(() => import("./pages/CancellationDashboard"))
const ManualHome = lazyRetry(() => import("./pages/ManualHome"))
const ManualArticleViewer = lazyRetry(() => import("./pages/ManualArticleViewer"))
const TVDashboard = lazyRetry(() => import("./pages/TVDashboard"))
const TVPublicGate = lazyRetry(() => import("./pages/TVPublicGate"))
const CompanyKnowledge = lazyRetry(() => import("./pages/CompanyKnowledge"))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPending } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isPending) {
    return <Navigate to="/pending" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function PermissionRoute({ children, permission }: { children: React.ReactNode; permission: keyof RolePermissions }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading, isPending } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={user && !isPending ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={user && !isPending ? <Navigate to="/" replace /> : <Register />}
        />
        <Route
          path="/pending"
          element={
            !user ? <Navigate to="/login" replace /> :
            !isPending ? <Navigate to="/" replace /> :
            <PendingApproval />
          }
        />
        <Route path="/manual" element={<ManualHome />} />
        <Route path="/manual/:id" element={<ManualArticleViewer />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/help/content" element={<HelpContent />} />
        <Route path="/help/content/:id" element={<HelpContentViewer />} />
        <Route path="/help/manuals" element={<HelpManuals />} />
        <Route path="/help/manuals/:id" element={<HelpManualViewer />} />
        <Route path="/help/videos" element={<HelpVideos />} />
        <Route path="/help/tickets" element={<HelpTickets />} />
        <Route path="/help/tickets/new" element={<HelpOpenTicket />} />
        <Route path="/help/chat" element={<HelpAIChat />} />
        <Route path="/tv-dashboard" element={<ProtectedRoute><TVDashboard /></ProtectedRoute>} />
        <Route path="/tv" element={<TVPublicGate />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/agents" element={<AdminRoute><Agents /></AdminRoute>} />
                    <Route path="/inbox" element={<Navigate to="/kanban/support" replace />} />
                    <Route path="/tickets" element={<Navigate to="/kanban/support" replace />} />
                    <Route path="/kanban/:slug" element={<KanbanPage />} />
                    <Route path="/knowledge" element={<Knowledge />} />
                    <Route path="/company-knowledge" element={<AdminRoute><CompanyKnowledge /></AdminRoute>} />
                    <Route path="/whatsapp" element={<WhatsAppPage />} />
                    <Route path="/automations" element={<AdminRoute><Automations /></AdminRoute>} />
                    <Route path="/automations/new" element={<AdminRoute><AutomationEditor /></AdminRoute>} />
                    <Route path="/automations/:id" element={<AdminRoute><AutomationEditor /></AdminRoute>} />
                    <Route path="/flow-builder" element={<AdminRoute><FlowBuilder /></AdminRoute>} />
                    <Route path="/flow-builder/:id" element={<AdminRoute><FlowBuilder /></AdminRoute>} />
                    <Route path="/whatsapp-instances" element={<AdminRoute><WhatsAppInstances /></AdminRoute>} />
                    <Route path="/whatsapp-test-panel" element={<WhatsAppTestPanel />} />
                    <Route path="/ai-consumption" element={<AdminRoute><AIConsumptionDashboard /></AdminRoute>} />
                    <Route path="/api-logs" element={<AdminRoute><ApiLogs /></AdminRoute>} />
                    <Route path="/agents/playground/:agentId" element={<AdminRoute><AgentPlayground /></AdminRoute>} />
                    <Route path="/agents/builder/:id?" element={<AdminRoute><AgentBuilder /></AdminRoute>} />
                    <Route path="/agents/:id/activity" element={<AdminRoute><AgentActivity /></AdminRoute>} />
                    <Route path="/automations/playground/:id" element={<AdminRoute><AutomationPlayground /></AdminRoute>} />
                    <Route path="/flow-builder/playground/:id" element={<AdminRoute><AutomationPlayground /></AdminRoute>} />
                    <Route path="/ai-settings" element={<AdminRoute><AISettings /></AdminRoute>} />
                    <Route path="/ai-tools" element={<AdminRoute><AITools /></AdminRoute>} />
                    <Route path="/cto-advisor" element={<AdminRoute><CTOAdvisor /></AdminRoute>} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/duplicates" element={<ClientDuplicates />} />
                    <Route path="/clients/:id" element={<ClientDetail />} />
                    <Route path="/clients/:id/360" element={<Customer360 />} />
                    <Route path="/gl-sync" element={<GLSyncDashboard />} />
                    <Route path="/settings" element={<PermissionRoute permission="manageCategories"><Settings /></PermissionRoute>} />
                    
                    <Route path="/queue" element={<Queue />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/docs" element={<Documentation />} />
                    <Route path="/macros" element={<Macros />} />
                    <Route path="/feriados" element={<Feriados />} />
                    <Route path="/service-catalog" element={<ServiceCatalog />} />
                    <Route path="/campaigns" element={<AdminRoute><Campaigns /></AdminRoute>} />
                    <Route path="/skills" element={<AdminRoute><Skills /></AdminRoute>} />
                    <Route path="/ai-configurator" element={<AIConfigurator />} />
                    <Route path="/ai-builder" element={<AdminRoute><AIBuilder /></AdminRoute>} />
                    <Route path="/updates" element={<Updates />} />
                    <Route path="/supervisor" element={<AdminRoute><Supervisor /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                    <Route path="/admin/permissions" element={<AdminRoute><AdminPermissions /></AdminRoute>} />
                    <Route path="/admin/integrations" element={<AdminRoute><AdminIntegrations /></AdminRoute>} />
                    <Route path="/admin/api-keys" element={<AdminRoute><AdminApiKeys /></AdminRoute>} />
                    <Route path="/admin/whatsapp" element={<AdminRoute><WhatsAppIntegration /></AdminRoute>} />
                    <Route path="/admin/manuais" element={<PermissionRoute permission="manageKnowledgeBase"><AdminManuais /></PermissionRoute>} />
                    <Route path="/admin/manuais/new" element={<PermissionRoute permission="manageKnowledgeBase"><AdminManualEditor /></PermissionRoute>} />
                    <Route path="/admin/manuais/:id" element={<PermissionRoute permission="manageKnowledgeBase"><AdminManualEditor /></PermissionRoute>} />
                    <Route path="/admin/help" element={<PermissionRoute permission="manageKnowledgeBase"><HelpAdminDashboard /></PermissionRoute>} />
                    <Route path="/admin/help/videos" element={<PermissionRoute permission="manageKnowledgeBase"><AdminHelpVideos /></PermissionRoute>} />
                    <Route path="/admin/webhook-logs" element={<AdminRoute><WebhookBillingLogs /></AdminRoute>} />
                    <Route path="/admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
                    <Route path="/evaluations" element={<Evaluations />} />
                    <Route path="/feedback" element={<Feedback />} />
                    <Route path="/reports/tickets" element={<PermissionRoute permission="viewReports"><TicketReport /></PermissionRoute>} />
                    <Route path="/reports/company-volume" element={<PermissionRoute permission="viewReports"><CompanyVolumeReport /></PermissionRoute>} />
                    <Route path="/reports/executive" element={<PermissionRoute permission="viewReports"><ExecutiveDashboard /></PermissionRoute>} />
                    <Route path="/ai-lab" element={<AdminRoute><ExecutiveDashboard /></AdminRoute>} />
                    <Route path="/cancellation-dashboard" element={<PermissionRoute permission="viewReports"><CancellationDashboard /></PermissionRoute>} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/help/:section" element={<Help />} />
                    <Route path="/help/:section/:subsection" element={<Help />} />
                    <Route path="/whatsapp-web" element={<Navigate to="/kanban/support" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

const App = () => {
  if (!isConfigured) {
    return <SetupWizard />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
        <SpeedInsights />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
