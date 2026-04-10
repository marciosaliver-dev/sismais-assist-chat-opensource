import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FlaskConical,
  Send,
  Bot,
  MessageSquare,
  Phone,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  Clock,
  Zap,
  BookOpen,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface TestMessage {
  id: string
  direction: "sent" | "received"
  content: string
  timestamp: string
  agent_name?: string
  confidence?: number
  rag_used?: boolean
  delivery_status?: string
}

export default function WhatsAppTestPanel() {
  const queryClient = useQueryClient()
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("")
  const [testPhone, setTestPhone] = useState("")
  const [messageText, setMessageText] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState<string>("auto")
  const [testMessages, setTestMessages] = useState<TestMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch instances
  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uazapi_instances")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: 10000,
  })

  // Fetch AI agents
  const { data: agents = [] } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, specialty, is_active")
        .eq("is_active", true)
        .order("priority", { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Get selected instance
  const selectedInstance = instances.find((i) => i.id === selectedInstanceId)

  // Load test config when instance changes
  useEffect(() => {
    if (selectedInstance) {
      setTestPhone((selectedInstance as any).test_phone_number || "")
    }
  }, [selectedInstanceId, selectedInstance])

  // Fetch recent test messages when phone is set
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["test-messages", selectedInstanceId, testPhone],
    queryFn: async () => {
      if (!selectedInstanceId || !testPhone) return []
      const cleanPhone = testPhone.replace(/\D/g, "")
      if (!cleanPhone || cleanPhone.length < 8) return []

      // Look for messages matching test phone in this instance
      const { data: chats } = await supabase
        .from("uazapi_chats")
        .select("id")
        .eq("instance_id", selectedInstanceId)
        .ilike("contact_phone", `%${cleanPhone}%`)
        .limit(1)

      if (!chats?.length) return []

      const { data: msgs, error } = await supabase
        .from("uazapi_messages")
        .select("message_id, from_me, text_body, type, timestamp, status")
        .eq("chat_id", chats[0].id)
        .order("timestamp", { ascending: false })
        .limit(30)

      if (error) return []
      return (msgs || []).reverse().map((m) => ({
        id: m.message_id,
        direction: m.from_me ? "sent" as const : "received" as const,
        content: m.text_body || `[${m.type}]`,
        timestamp: m.timestamp,
        delivery_status: m.status,
      }))
    },
    enabled: !!selectedInstanceId && !!testPhone && testPhone.replace(/\D/g, "").length >= 8,
    refetchInterval: 5000,
  })

  // Update test messages list
  useEffect(() => {
    if (recentMessages.length > 0) {
      setTestMessages(recentMessages)
    }
  }, [recentMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [testMessages])

  // Toggle test mode
  const toggleTestMode = useMutation({
    mutationFn: async ({ instanceId, enabled }: { instanceId: string; enabled: boolean }) => {
      const { error } = await (supabase as any)
        .from("uazapi_instances")
        .update({
          test_mode: enabled,
          test_phone_number: enabled ? testPhone.replace(/\D/g, "") : null,
        })
        .eq("id", instanceId)
      if (error) throw error
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] })
      toast.success(enabled ? "Modo teste ativado!" : "Modo teste desativado!")
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  })

  // Save test phone number
  const saveTestPhone = useMutation({
    mutationFn: async ({ instanceId, phone }: { instanceId: string; phone: string }) => {
      const { error } = await (supabase as any)
        .from("uazapi_instances")
        .update({ test_phone_number: phone.replace(/\D/g, "") })
        .eq("id", instanceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] })
      toast.success("Número de teste salvo!")
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  })

  // Send test message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedInstanceId || !testPhone || !messageText.trim()) {
        throw new Error("Preencha todos os campos")
      }

      const cleanPhone = testPhone.replace(/\D/g, "")
      const chatJid = `${cleanPhone}@s.whatsapp.net`

      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: {
          action: "sendMessage",
          instanceId: selectedInstanceId,
          chatJid,
          type: "text",
          text: messageText.trim(),
        },
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      const newMsg: TestMessage = {
        id: crypto.randomUUID(),
        direction: "sent",
        content: messageText.trim(),
        timestamp: new Date().toISOString(),
        delivery_status: "sent",
      }
      setTestMessages((prev) => [...prev, newMsg])
      setMessageText("")
      toast.success("Mensagem enviada!")
    },
    onError: (e: Error) => toast.error("Erro ao enviar: " + e.message),
  })

  // Trigger AI reply manually
  const triggerAiReply = useMutation({
    mutationFn: async () => {
      if (!selectedInstanceId || !testPhone) {
        throw new Error("Selecione instância e número de teste")
      }

      const cleanPhone = testPhone.replace(/\D/g, "")
      const chatJid = `${cleanPhone}@s.whatsapp.net`

      // Find the uazapi_chat for this phone
      const { data: chats } = await supabase
        .from("uazapi_chats")
        .select("id")
        .eq("instance_id", selectedInstanceId)
        .ilike("contact_phone", `%${cleanPhone}%`)
        .limit(1)

      if (!chats?.length) {
        throw new Error("Chat não encontrado. Envie uma mensagem primeiro para criar o chat.")
      }

      // Find conversation for this chat
      const { data: conv } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("uazapi_chat_id", chatJid)
        .not("status", "in", '("finalizado","resolvido","cancelado")')
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!conv) {
        throw new Error("Conversa IA não encontrada. O número de teste precisa ter uma conversa ativa.")
      }

      // Call ai-whatsapp-reply directly
      const { data, error } = await supabase.functions.invoke("ai-whatsapp-reply", {
        body: {
          messageId: `test_${Date.now()}`,
          chatId: chats[0].id,
          instanceId: selectedInstanceId,
          conversationId: conv.id,
          text: "Responda a última mensagem do cliente.",
          ...(selectedAgentId !== "auto" ? { forceAgentId: selectedAgentId } : {}),
        },
      })

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`IA respondeu! Agente: ${data.agent || "auto"}, Tokens: ${data.tokens || 0}, RAG: ${data.rag_used ? "Sim" : "Não"}`)
        // Refresh messages
        queryClient.invalidateQueries({ queryKey: ["test-messages"] })
      } else if (data?.skipped) {
        toast.info(`IA pulou: ${data.reason}`)
      } else {
        toast.warning("Resposta inesperada da IA")
      }
    },
    onError: (e: Error) => toast.error("Erro IA: " + e.message),
  })

  const isTestModeActive = (selectedInstance as any)?.test_mode === true

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            Painel de Testes WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Teste agentes IA com números mapeados. Em modo teste, a IA só responde ao número configurado.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Config */}
          <div className="space-y-4">
            {/* Instance Selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Configuração de Teste
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Instância WhatsApp</Label>
                  <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione uma instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          <span className="flex items-center gap-2">
                            {inst.status === "connected" ? (
                              <Wifi className="w-3 h-3 text-green-500" />
                            ) : (
                              <WifiOff className="w-3 h-3 text-muted-foreground" />
                            )}
                            {inst.instance_name}
                            {inst.phone_number && (
                              <span className="text-xs text-muted-foreground">
                                ({inst.phone_number})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedInstance && (
                  <>
                    {/* Instance status */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <Badge
                        className={cn(
                          "text-xs",
                          selectedInstance.status === "connected"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        )}
                      >
                        {selectedInstance.status === "connected" ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Conectado</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" /> {selectedInstance.status}</>
                        )}
                      </Badge>
                    </div>

                    {/* Test phone */}
                    <div>
                      <Label className="text-xs">Número de Teste</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="5511999999999"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            saveTestPhone.mutate({
                              instanceId: selectedInstanceId,
                              phone: testPhone,
                            })
                          }
                          disabled={!testPhone || saveTestPhone.isPending}
                        >
                          Salvar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Formato: DDI + DDD + Número (ex: 5511999999999)
                      </p>
                    </div>

                    {/* Test Mode Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Modo Teste</Label>
                        <p className="text-xs text-muted-foreground">
                          IA só responde ao número de teste
                        </p>
                      </div>
                      <Switch
                        checked={isTestModeActive}
                        onCheckedChange={(checked) => {
                          if (checked && !testPhone.replace(/\D/g, "")) {
                            toast.error("Configure o número de teste primeiro")
                            return
                          }
                          toggleTestMode.mutate({
                            instanceId: selectedInstanceId,
                            enabled: checked,
                          })
                        }}
                        disabled={toggleTestMode.isPending}
                      />
                    </div>

                    {isTestModeActive && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                        <p className="text-xs text-yellow-500">
                          Modo teste ativo! A IA só responde ao número {testPhone}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Agent Selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Agente IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Selecionar Agente</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-primary" />
                          Automático (Orquestrador)
                        </span>
                      </SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <span className="flex items-center gap-2">
                            <Bot className="w-3 h-3" />
                            {agent.name}
                            <Badge variant="outline" className="text-xs py-0 px-1">
                              {agent.specialty}
                            </Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => triggerAiReply.mutate()}
                  disabled={
                    !selectedInstanceId ||
                    !testPhone ||
                    triggerAiReply.isPending ||
                    selectedInstance?.status !== "connected"
                  }
                >
                  {triggerAiReply.isPending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Processando IA...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Disparar Resposta IA</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Faz a IA responder a última mensagem recebida no chat de teste
                </p>
              </CardContent>
            </Card>

            {/* Stats */}
            {selectedInstance && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Instâncias Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {instances.map((inst) => (
                    <div
                      key={inst.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg text-sm",
                        inst.id === selectedInstanceId
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {inst.status === "connected" ? (
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                        <span className="font-medium">{inst.instance_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(inst as any).test_mode && (
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs py-0">
                            TESTE
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs py-0",
                            inst.status === "connected" ? "text-green-400" : "text-muted-foreground"
                          )}
                        >
                          {inst.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Chat & Messages */}
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-220px)] flex flex-col">
              <CardHeader className="pb-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Chat de Teste
                    {testPhone && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {testPhone}
                      </Badge>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["test-messages"] })}
                    className="gap-1 text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!selectedInstanceId ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                    <FlaskConical className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Selecione uma instância para começar</p>
                  </div>
                ) : testMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                    <MessageSquare className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Nenhuma mensagem no chat de teste</p>
                    <p className="text-xs">Envie uma mensagem para iniciar o teste</p>
                  </div>
                ) : (
                  testMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.direction === "sent" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-xl px-4 py-2.5 space-y-1",
                          msg.direction === "sent"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs opacity-70">
                            {msg.timestamp
                              ? new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {msg.direction === "sent" && msg.delivery_status && (
                            <span className="text-xs opacity-70">
                              {msg.delivery_status === "sent" ? "✓" : msg.delivery_status === "failed" ? "✗" : "⧗"}
                            </span>
                          )}
                        </div>
                        {msg.agent_name && (
                          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-white/10">
                            <Bot className="w-3 h-3" />
                            <span className="text-xs">
                              {msg.agent_name}
                              {msg.confidence != null && ` • ${Math.round(msg.confidence * 100)}%`}
                              {msg.rag_used && " • RAG"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="p-3 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={
                      selectedInstance?.status !== "connected"
                        ? "Instância desconectada..."
                        : "Digite uma mensagem de teste..."
                    }
                    className="min-h-[42px] max-h-[120px] resize-none"
                    disabled={!selectedInstanceId || selectedInstance?.status !== "connected"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        if (messageText.trim() && !sendMessage.isPending) {
                          sendMessage.mutate()
                        }
                      }
                    }}
                  />
                  <Button
                    className="shrink-0 self-end"
                    onClick={() => sendMessage.mutate()}
                    disabled={
                      !messageText.trim() ||
                      !selectedInstanceId ||
                      !testPhone ||
                      sendMessage.isPending ||
                      selectedInstance?.status !== "connected"
                    }
                  >
                    {sendMessage.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
