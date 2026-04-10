import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoriesTab from "@/components/settings/CategoriesTab";
import ModulesTab from "@/components/settings/ModulesTab";
import KanbanAndStagesTab from "@/components/settings/KanbanAndStagesTab";
import CloseRequirementsTab from "@/components/settings/CloseRequirementsTab";
import SLAQualityTab from "@/components/settings/SLAQualityTab";
import SLAConfigTab from "@/components/settings/SLAConfigTab";
import PriorityRulesTab from "@/components/settings/PriorityRulesTab";
import AttendanceSettingsTab from "@/components/settings/AttendanceSettingsTab";
import IntegrationsWebhooksTab from "@/components/settings/IntegrationsWebhooksTab";
import BoardLeadersTab from "@/components/settings/BoardLeadersTab";
import TVDashboardSettingsTab from "@/components/settings/TVDashboardSettingsTab";
import HolidaysTab from "@/components/settings/HolidaysTab";
import BusinessHoursGlobalTab from "@/components/settings/BusinessHoursGlobalTab";
import { AIModelsTab } from "@/components/settings/AIModelsTab";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { DeployNotifyDialog } from "@/components/admin/DeployNotifyDialog";
import { useAuth } from "@/contexts/AuthContext";

const Settings = () => {
  const [discordOpen, setDiscordOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const defaultTab = searchParams.get("tab") || "categories";

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin ? "Categorias, Kanban, SLA e integrações" : "Categorias e Módulos"}
            </p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setDiscordOpen(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Notificar Discord
            </Button>
          )}
        </div>
        <DeployNotifyDialog open={discordOpen} onOpenChange={setDiscordOpen} />

        <Tabs defaultValue={defaultTab} className="w-full mt-4">
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="modules">Módulos / Procedimentos</TabsTrigger>
            {isAdmin && <TabsTrigger value="kanban">Kanbans e Etapas</TabsTrigger>}
            {isAdmin && <TabsTrigger value="close">Encerramento</TabsTrigger>}
            {isAdmin && <TabsTrigger value="sla">SLA e Qualidade</TabsTrigger>}
            {isAdmin && <TabsTrigger value="attendance">Atendimento</TabsTrigger>}
            {isAdmin && <TabsTrigger value="integrations">Integrações e Webhooks</TabsTrigger>}
            {isAdmin && <TabsTrigger value="sla-config">SLA IA</TabsTrigger>}
            {isAdmin && <TabsTrigger value="priority-rules">Regras de Prioridade</TabsTrigger>}
            {isAdmin && <TabsTrigger value="board-leaders">Líderes e Alertas</TabsTrigger>}
            {isAdmin && <TabsTrigger value="tv-dashboard">TV Dashboard</TabsTrigger>}
            {isAdmin && <TabsTrigger value="business-hours">Expediente</TabsTrigger>}
            {isAdmin && <TabsTrigger value="holidays">Feriados</TabsTrigger>}
            {isAdmin && <TabsTrigger value="ai-models">Modelos IA</TabsTrigger>}
          </TabsList>

          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="modules">
            <ModulesTab />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="kanban">
              <KanbanAndStagesTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="close">
              <CloseRequirementsTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="sla">
              <SLAQualityTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="attendance">
              <AttendanceSettingsTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="integrations">
              <IntegrationsWebhooksTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="sla-config">
              <SLAConfigTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="priority-rules">
              <PriorityRulesTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="board-leaders">
              <BoardLeadersTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="tv-dashboard">
              <TVDashboardSettingsTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="business-hours">
              <BusinessHoursGlobalTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="holidays">
              <HolidaysTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="ai-models">
              <AIModelsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
