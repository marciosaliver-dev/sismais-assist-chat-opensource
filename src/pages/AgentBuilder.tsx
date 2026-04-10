import { useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Rocket, Loader2, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAgentBuilder } from '@/hooks/useAgentBuilder'
import BuilderChat from '@/components/agent-builder/BuilderChat'
import BuilderPreview from '@/components/agent-builder/BuilderPreview'
import PreviewTestChat from '@/components/agent-builder/PreviewTestChat'

const WELCOME_MESSAGE = 'Me conte sobre o agente que você quer criar. O que ele faz? Quem ele atende? Qual o tom ideal?'

export default function AgentBuilder() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const {
    config,
    chatMessages,
    isGenerating,
    isTesting,
    setIsTesting,
    builderContext,
    sendMessage,
    askExplanation,
    updateConfig,
    toggleSkill,
    toggleTool,
    toggleInstance,
    saveAgent,
    setChatMessages,
  } = useAgentBuilder(id)

  // Inject welcome message on mount (only for new agents)
  useEffect(() => {
    if (!id && chatMessages.length === 0) {
      setChatMessages([{
        id: 'welcome',
        role: 'assistant',
        content: WELCOME_MESSAGE,
        timestamp: new Date(),
      }])
    }
  }, [])

  // Auto-send template prompt if provided via search params
  useEffect(() => {
    const templatePrompt = searchParams.get('prompt')
    if (templatePrompt && chatMessages.length <= 1) {
      setTimeout(() => sendMessage(templatePrompt), 500)
    }
  }, [searchParams])

  const isSaving = saveAgent.isPending

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/agents')}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 h-8 w-8"
            aria-label="Voltar para agentes"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#10293F] flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-[#45E5E5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">Agent Builder</span>
                <Badge variant="outline" className="text-xs bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)] hidden sm:flex">
                  Beta
                </Badge>
              </div>
              {config.name && (
                <p className="text-xs text-muted-foreground truncate">{config.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTesting(!isTesting)}
            className={isTesting
              ? 'bg-[#E8F9F9] border-[#45E5E5] text-[#10293F] hover:bg-[#45E5E5]/20'
              : ''
            }
            disabled={!config.name}
          >
            <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">{isTesting ? 'Parar Teste' : 'Testar'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => saveAgent.mutate()}
            disabled={isSaving || !config.name}
            className="bg-[#45E5E5] hover:bg-[#2ecece] text-[#10293F] font-semibold"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5 mr-1.5" />
            )}
            <span className="hidden sm:inline">{id ? 'Atualizar' : 'Publicar'}</span>
          </Button>
        </div>
      </div>

      {/* Body: 60/40 split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat — 60% */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 60%' }}>
          <div className="px-4 py-2 border-b border-border bg-muted/20 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurador por IA</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <BuilderChat
              messages={chatMessages}
              onSend={sendMessage}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-border flex-shrink-0" />

        {/* Preview — 40% */}
        <div className="flex flex-col overflow-hidden flex-1">
          <div className="px-4 py-2 border-b border-border bg-muted/20 flex-shrink-0 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isTesting ? 'Modo Teste' : 'Preview do Agente'}
            </p>
            {isTesting && (
              <button
                onClick={() => setIsTesting(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Voltar ao preview
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {isTesting ? (
              <PreviewTestChat
                agentId={id}
                config={config}
                onClose={() => setIsTesting(false)}
              />
            ) : (
              <BuilderPreview
                config={config}
                builderContext={builderContext}
                toggleSkill={toggleSkill}
                toggleTool={toggleTool}
                toggleInstance={toggleInstance}
                updateConfig={updateConfig}
                onAskExplanation={askExplanation}
                onStartTest={() => setIsTesting(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
