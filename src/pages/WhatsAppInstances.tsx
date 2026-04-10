import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smartphone,
  Plus,
  QrCode,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  LogOut,
  Wifi,
  MessageSquare,
  Activity,
  LayoutGrid,
  Settings2,
  AlertTriangle,
  Bot,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { MetaInstancesTab } from "@/components/whatsapp/MetaInstancesTab";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useKanbanBoards } from "@/hooks/useKanbanBoards";

export default function WhatsAppInstances() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceUrl, setNewInstanceUrl] = useState("");
  const [newInstanceToken, setNewInstanceToken] = useState("");
  const [newInstanceBoardId, setNewInstanceBoardId] = useState("");

  const { data: boards = [] } = useKanbanBoards();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_instances")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const configureWebhook = async (instanceId: string) => {
    try {
      const { error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "configureWebhook", instanceId },
      });
      if (error) throw error;
      toast.success("Webhook configurado automaticamente!");
    } catch (e: any) {
      console.error("Webhook config error:", e);
      toast.error("Erro ao configurar webhook: " + (e?.message || "desconhecido"));
    }
  };

  const addInstance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_instances")
        .insert({
          instance_name: newInstanceName,
          api_url: newInstanceUrl.replace(/\/$/, ""),
          api_token: newInstanceToken,
          status: "disconnected",
          ...(newInstanceBoardId ? { kanban_board_id: newInstanceBoardId } : {}),
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      setNewInstanceName("");
      setNewInstanceUrl("");
      setNewInstanceToken("");
      setNewInstanceBoardId("");
      setIsDialogOpen(false);
      toast.success("Instância adicionada! Configurando webhook e verificando status...");
      // Auto-configure webhook
      await configureWebhook(data.id);
      // Auto-detect real status from UAZAPI
      checkStatus.mutate(data.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkStatus = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "status", instanceId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error("Erro ao verificar status: " + e.message),
  });

  const connectInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "connect", instanceId },
      });
      if (error) throw error;
      return { data, instanceId };
    },
    onSuccess: async ({ data, instanceId }) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      if (data?.qrcode) {
        toast.success("QR Code gerado! Escaneie com o WhatsApp.");
      } else {
        toast.success("Conexão iniciada!");
      }
      // Auto-configure webhook on connect
      await configureWebhook(instanceId);
    },
    onError: (e: Error) => toast.error("Erro ao conectar: " + e.message),
  });

  const disconnectInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "disconnect", instanceId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Desconectado!");
    },
    onError: (e: Error) => toast.error("Erro ao desconectar: " + e.message),
  });

  const deleteInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const { error } = await supabase
        .from("uazapi_instances")
        .delete()
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Instância excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBoard = useMutation({
    mutationFn: async ({ instanceId, boardId }: { instanceId: string; boardId: string | null }) => {
      const { error } = await (supabase as any)
        .from("uazapi_instances")
        .update({ kanban_board_id: boardId })
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Kanban atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTestMode = useMutation({
    mutationFn: async ({ instanceId, testMode, testPhone }: { instanceId: string; testMode: boolean; testPhone?: string }) => {
      const updates: any = { test_mode: testMode };
      if (testPhone !== undefined) updates.test_phone_number = testPhone;
      const { error } = await (supabase as any)
        .from("uazapi_instances")
        .update(updates)
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Modo de teste atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [testPhoneInputs, setTestPhoneInputs] = useState<Record<string, string>>({});
  const [testingAI, setTestingAI] = useState<string | null>(null);

  const testAIWithPhone = async (instanceId: string, phone: string) => {
    if (!phone) {
      toast.error("Configure o número de teste primeiro");
      return;
    }
    setTestingAI(instanceId);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: {
          action: "sendText",
          instanceId,
          phone: phone.replace(/\D/g, ""),
          message: "👋 Olá! Esta é uma mensagem de teste do sistema de IA. Como posso ajudar?",
        },
      });
      if (error) throw error;
      toast.success("Mensagem de teste enviada para " + phone);
    } catch (e: any) {
      toast.error("Erro ao enviar teste: " + (e?.message || "desconhecido"));
    } finally {
      setTestingAI(null);
    }
  };

  const [deleteInstanceId, setDeleteInstanceId] = useState<string | null>(null);
  const [clearHistoryInstanceId, setClearHistoryInstanceId] = useState<string | null>(null);

  const clearInstanceHistory = useMutation({
    mutationFn: async (instanceId: string) => {
      const BATCH_SIZE = 50;

      const deleteInBatches = async (table: string, column: string, ids: string[]) => {
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const chunk = ids.slice(i, i + BATCH_SIZE);
          const { error } = await (supabase.from(table as any).delete() as any).in(column, chunk);
          if (error) throw error;
        }
      };

      // 1. Buscar IDs dos chats desta instância
      const { data: chats } = await supabase
        .from("uazapi_chats")
        .select("id")
        .eq("instance_id", instanceId);
      const chatIds = (chats || []).map((c) => c.id);

      // 2. Deletar uazapi_messages dos chats em lotes
      if (chatIds.length > 0) {
        await deleteInBatches("uazapi_messages", "chat_id", chatIds);
      }

      // 3. Buscar IDs das conversas IA desta instância
      const { data: convs } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("whatsapp_instance_id", instanceId);
      const convIds = (convs || []).map((c) => c.id);

      // 4. Deletar ai_messages das conversas em lotes
      if (convIds.length > 0) {
        await deleteInBatches("ai_messages", "conversation_id", convIds);
      }

      // 5. Deletar ai_conversations
      const { error: convError } = await supabase
        .from("ai_conversations")
        .delete()
        .eq("whatsapp_instance_id", instanceId);
      if (convError) throw convError;

      // 6. Deletar uazapi_chats
      const { error: chatError } = await supabase
        .from("uazapi_chats")
        .delete()
        .eq("instance_id", instanceId);
      if (chatError) throw chatError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uazapi-chats"] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast.success("Histórico limpo com sucesso!");
      setClearHistoryInstanceId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmDeleteInstance = async () => {
    if (!deleteInstanceId) return;
    deleteInstance.mutate(deleteInstanceId);
    setDeleteInstanceId(null);
  };

  const connectedCount = instances.filter((i) => i.status === "connected").length;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" /> Conectado
          </Badge>
        );
      case "qrcode":
      case "connecting":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <QrCode className="w-3 h-3 mr-1" /> Aguardando QR
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="w-3 h-3 mr-1" /> Desconectado
          </Badge>
        );
    }
  };

  const getTestModeBadge = (instance: any) => {
    if (!(instance as any).test_mode) return null;
    return (
      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 gap-1">
        <AlertTriangle className="w-3 h-3" /> Modo Teste
      </Badge>
    );
  };

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Instâncias WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie suas conexões WhatsApp
          </p>
        </div>

        <Tabs defaultValue="uazapi" className="space-y-4">
          <TabsList>
            <TabsTrigger value="uazapi" className="gap-1">
              <Smartphone className="h-4 w-4" />
              UAZAPI
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-1">
              <ShieldCheck className="h-4 w-4" />
              Meta Cloud API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="uazapi">
        <div className="flex items-center justify-between">
          <div />

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Instância WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Nome da Instância</Label>
                  <Input
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    placeholder="Ex: Vendas, Suporte, Principal"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>URL da API UAZAPI</Label>
                  <Input
                    value={newInstanceUrl}
                    onChange={(e) => setNewInstanceUrl(e.target.value)}
                    placeholder="https://seudominio.uazapi.com"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Token de Autenticação</Label>
                  <Input
                    value={newInstanceToken}
                    onChange={(e) => setNewInstanceToken(e.target.value)}
                    placeholder="seu-token-aqui"
                    type="password"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Kanban de Destino</Label>
                  <Select value={newInstanceBoardId} onValueChange={setNewInstanceBoardId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Board padrão do sistema" />
                    </SelectTrigger>
                    <SelectContent>
                      {boards.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se não selecionado, usa o board padrão global
                  </p>
                </div>
                <Button
                  onClick={() => addInstance.mutate()}
                  disabled={
                    !newInstanceName ||
                    !newInstanceUrl ||
                    !newInstanceToken ||
                    addInstance.isPending
                  }
                  className="w-full"
                >
                  {addInstance.isPending ? "Adicionando..." : "Adicionar Instância"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{instances.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Wifi className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conectadas</p>
                <p className="text-2xl font-bold text-foreground">{connectedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-foreground">
                  {instances.filter((i) => i.is_active).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instances Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => (
            <Card key={instance.id} className="relative overflow-hidden">
              {instance.status === "connected" && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{instance.instance_name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getTestModeBadge(instance)}
                    {getStatusBadge(instance.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {instance.phone_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium text-foreground">{instance.phone_number}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">API URL:</span>
                  <span className="font-mono text-xs text-foreground truncate max-w-[160px]">
                    {instance.api_url}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Atualizado:</span>
                  <span className="text-foreground">
                    {instance.updated_at
                      ? formatDistanceToNow(new Date(instance.updated_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                      : "Nunca"}
                  </span>
                </div>

                {/* Kanban Board selector */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3" /> Kanban:
                  </span>
                  <Select
                    value={(instance as any).kanban_board_id || "none"}
                    onValueChange={(val) =>
                      updateBoard.mutate({
                        instanceId: instance.id,
                        boardId: val === "none" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Padrão</SelectItem>
                      {boards.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Test Mode Section */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" /> Modo Teste IA:
                    </span>
                    <Switch
                      checked={(instance as any).test_mode || false}
                      onCheckedChange={(checked) => {
                        updateTestMode.mutate({
                          instanceId: instance.id,
                          testMode: checked,
                          testPhone: testPhoneInputs[instance.id] || (instance as any).test_phone_number || "",
                        });
                      }}
                    />
                  </div>
                  {(instance as any).test_mode && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="5577812345678"
                          className="h-7 text-xs flex-1"
                          value={testPhoneInputs[instance.id] ?? (instance as any).test_phone_number ?? ""}
                          onChange={(e) =>
                            setTestPhoneInputs((prev) => ({ ...prev, [instance.id]: e.target.value }))
                          }
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== ((instance as any).test_phone_number || "")) {
                              updateTestMode.mutate({ instanceId: instance.id, testMode: true, testPhone: val });
                            }
                          }}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 text-xs"
                        disabled={instance.status !== "connected" || testingAI === instance.id}
                        onClick={() =>
                          testAIWithPhone(
                            instance.id,
                            testPhoneInputs[instance.id] || (instance as any).test_phone_number || ""
                          )
                        }
                      >
                        <Bot className="w-3.5 h-3.5" />
                        {testingAI === instance.id ? "Enviando..." : "Testar IA"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Apenas mensagens deste número serão processadas pela IA
                      </p>
                    </div>
                  )}
                </div>

                {/* QR Code display */}
                {(instance.status === "qrcode" || instance.status === "connecting") &&
                  instance.qr_code && (
                    <div className="flex flex-col items-center py-2 gap-2">
                      <img
                        src={instance.qr_code}
                        alt="QR Code"
                        className="w-40 h-40 rounded-lg border border-border"
                      />
                      <p className="text-xs text-muted-foreground">Escaneie com WhatsApp</p>
                    </div>
                  )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => checkStatus.mutate(instance.id)}
                      disabled={checkStatus.isPending}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Status
                    </Button>
                    {instance.status !== "connected" ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => connectInstance.mutate(instance.id)}
                        disabled={connectInstance.isPending}
                      >
                        <Wifi className="w-3.5 h-3.5" />
                        Conectar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 text-destructive hover:text-destructive"
                        onClick={() => disconnectInstance.mutate(instance.id)}
                        disabled={disconnectInstance.isPending}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Desconectar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      aria-label="Excluir instancia"
                      onClick={() => setDeleteInstanceId(instance.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1 text-xs"
                    onClick={() => configureWebhook(instance.id)}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Configurar Webhook
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1 text-xs text-orange-500 border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-500"
                    onClick={() => setClearHistoryInstanceId(instance.id)}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Limpar Histórico
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {instances.length === 0 && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Smartphone className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma instância WhatsApp configurada</p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Primeira Instância
              </Button>
            </CardContent>
          </Card>
        )}
        <ConfirmDialog
          open={!!deleteInstanceId}
          onOpenChange={(open) => !open && setDeleteInstanceId(null)}
          title="Excluir instancia"
          description="Esta acao nao pode ser desfeita. A instancia WhatsApp sera removida permanentemente."
          confirmLabel="Excluir"
          onConfirm={confirmDeleteInstance}
          loading={deleteInstance.isPending}
        />
        <ConfirmDialog
          open={!!clearHistoryInstanceId}
          onOpenChange={(open) => !open && setClearHistoryInstanceId(null)}
          title="Limpar histórico da instância"
          description="Esta ação irá excluir permanentemente o histórico de conversas e mensagens registradas no sistema. As mensagens no WhatsApp não serão afetadas. Essa ação não pode ser desfeita."
          confirmLabel="Limpar Histórico"
          onConfirm={() => {
            if (clearHistoryInstanceId) clearInstanceHistory.mutate(clearHistoryInstanceId);
          }}
          loading={clearInstanceHistory.isPending}
        />
          </TabsContent>

          <TabsContent value="meta">
            <MetaInstancesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
