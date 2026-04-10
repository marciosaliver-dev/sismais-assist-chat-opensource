import { useState } from 'react'
import { Search, Bot, GitBranch, BookOpen, MessageSquare, TrendingUp, Users, Zap, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface GlossaryTerm {
  id: string
  icon: typeof Bot
  term: string
  simple: string
  fullExplanation: string
  example: string
  seeAlso?: string[]
  systemPath?: string
  systemPathHref?: string
}

const terms: GlossaryTerm[] = [
  {
    id: 'agent',
    icon: Bot,
    term: 'Agente IA',
    simple: 'Atendente Virtual Especializado',
    fullExplanation: 'Um Agente IA é como um funcionário virtual especializado em um assunto específico. Você pode ter múltiplos agentes, cada um com conhecimento e personalidade diferente — um para suporte técnico, outro para cobranças, outro para vendas.',
    example: 'Agente "Suporte NF-e": responde apenas sobre emissão de notas fiscais, erros de SEFAZ e certificados digitais.',
    seeAlso: ['system-prompt', 'routing', 'rag'],
    systemPath: 'Agentes IA',
    systemPathHref: '/agents',
  },
  {
    id: 'routing',
    icon: GitBranch,
    term: 'Roteamento IA / Orquestrador',
    simple: 'Sistema que decide qual agente responde',
    fullExplanation: 'O Orquestrador é o "supervisor" que analisa cada mensagem recebida e decide qual Agente IA deve responder. Ele usa Inteligência Artificial para ler o contexto da mensagem e comparar com a descrição de cada agente disponível.',
    example: 'Cliente pergunta "minha nota fiscal foi rejeitada" → Orquestrador escolhe o Agente Suporte NF-e.',
    seeAlso: ['agent', 'fallback'],
    systemPath: 'Guia de Roteamento',
    systemPathHref: '/help/routing/how-it-works',
  },
  {
    id: 'system-prompt',
    icon: MessageSquare,
    term: 'System Prompt',
    simple: 'Instruções de Personalidade da IA',
    fullExplanation: 'O System Prompt é o "manual de instruções" que você dá ao Agente IA. Nele você define: como o agente deve se apresentar, que tom usar, quais assuntos pode e não pode responder, informações sobre sua empresa e instruções específicas do negócio.',
    example: 'System Prompt: "Você é Ana, assistente do SisMais GL. Seja sempre cordial. Responda apenas sobre o sistema. Para cobranças, transfira para o Agente Financeiro."',
    seeAlso: ['agent', 'confidence'],
    systemPath: 'Agentes IA → Editar → Personalidade',
    systemPathHref: '/agents',
  },
  {
    id: 'rag',
    icon: BookOpen,
    term: 'RAG / Base de Conhecimento',
    simple: 'Busca Inteligente nos seus Artigos',
    fullExplanation: 'RAG (Retrieval-Augmented Generation) é o mecanismo que permite ao Agente IA consultar seus artigos antes de responder. Quando ativado, para cada pergunta, o sistema busca os artigos mais relevantes da Base de Conhecimento e usa essas informações para dar respostas mais precisas.',
    example: 'Cliente: "Como configuro o certificado digital?" → Sistema busca artigo "Configuração de Certificado Digital" → IA responde com base neste artigo.',
    seeAlso: ['agent', 'embedding', 'similarity-threshold'],
    systemPath: 'Base de Conhecimento',
    systemPathHref: '/knowledge',
  },
  {
    id: 'confidence',
    icon: TrendingUp,
    term: 'Confiança / Confidence Score',
    simple: 'Nível de Certeza da IA na Resposta',
    fullExplanation: 'Após gerar cada resposta, o sistema calcula uma pontuação de confiança (0% a 100%). Isso indica o quanto a IA "acredita" que a resposta está correta. Se a confiança ficar abaixo do Limite de Confiança configurado, a conversa é automaticamente transferida para um agente humano.',
    example: 'Agente com Limite de Confiança = 70%: resposta com 85% de confiança → enviada. Resposta com 60% de confiança → escalada para humano.',
    seeAlso: ['agent', 'escalation'],
    systemPath: 'Agentes IA → Editar → Config. LLM',
    systemPathHref: '/agents',
  },
  {
    id: 'escalation',
    icon: Users,
    term: 'Escalação / Handoff',
    simple: 'Transferência para Agente Humano',
    fullExplanation: 'Escalação é quando o sistema transfere automaticamente uma conversa da IA para um atendente humano. Isso ocorre quando: a IA está com confiança baixa, o cliente pede explicitamente um humano, o sentimento do cliente é muito negativo, ou houve muitas trocas de agente sem resolução.',
    example: 'Cliente: "Quero falar com uma pessoa real!" → Sistema detecta pedido de humano → Conversa vai para a fila de agentes humanos.',
    seeAlso: ['confidence', 'routing'],
  },
  {
    id: 'trigger',
    icon: Zap,
    term: 'Trigger / Gatilho',
    simple: 'Evento que Inicia uma Automação',
    fullExplanation: 'Um Trigger (Gatilho) é o evento que faz uma Automação ou Flow ser executado. Cada automação/flow precisa de um gatilho que define "quando" ela deve rodar.',
    example: 'Trigger "message_received": toda vez que um cliente enviar uma mensagem, a automação de boas-vindas é disparada.',
    seeAlso: ['flow-builder'],
    systemPath: 'Automações',
    systemPathHref: '/automations',
  },
  {
    id: 'flow-builder',
    icon: GitBranch,
    term: 'Flow Builder',
    simple: 'Editor Visual de Fluxos',
    fullExplanation: 'O Flow Builder é a ferramenta visual para criar fluxos de automação mais complexos. Diferente das Automações simples (que fazem apenas uma ação), no Flow Builder você pode criar sequências de ações com condições (se isso → faça aquilo, senão → faça aquilo outro).',
    example: 'Flow de boas-vindas: Recebe mensagem → Se horário comercial: envia "Olá! Em 5 minutos te atendemos" → Senão: envia "Estamos fora do horário..."',
    seeAlso: ['trigger'],
    systemPath: 'Flow Builder',
    systemPathHref: '/flow-builder',
  },
  {
    id: 'embedding',
    icon: Database,
    term: 'Embedding',
    simple: 'Impressão Digital de um Texto',
    fullExplanation: 'Um embedding é uma representação matemática do significado de um texto. Quando você cadastra um artigo na Base de Conhecimento, o sistema cria um embedding dele. Quando o cliente pergunta algo, o sistema cria um embedding da pergunta e compara com os embeddings dos artigos para encontrar os mais relevantes.',
    example: 'Artigo sobre "NF-e" e pergunta "nota fiscal" têm embeddings similares (mesmo significado), então o sistema os conecta corretamente.',
    seeAlso: ['rag', 'similarity-threshold'],
  },
  {
    id: 'similarity-threshold',
    icon: TrendingUp,
    term: 'Limite de Similaridade',
    simple: 'Qual o mínimo de relevância para usar um artigo',
    fullExplanation: 'O Limite de Similaridade define quão parecido um artigo precisa ser com a pergunta para ser usado pelo RAG. É um número de 0% a 100%. Quanto maior, mais restrito (exige artigo muito similar). Quanto menor, mais permissivo (usa artigos menos relevantes).',
    example: 'Limite = 75%: só artigos com 75%+ de similaridade são usados. Limite = 95%: muito restrito, quase nenhum artigo passa, a IA responde sem consultar a base.',
    seeAlso: ['rag', 'embedding'],
    systemPath: 'Agentes IA → Editar → Conhecimento',
    systemPathHref: '/agents',
  },
]

export function Glossary() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.simple.toLowerCase().includes(search.toLowerCase()) ||
      t.fullExplanation.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Glossário de Termos</h1>
        <p className="text-muted-foreground">
          Definições simples dos termos usados no sistema Sismais Helpdesk IA.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar termo..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Nenhum termo encontrado para "{search}"</p>
      )}

      <div className="space-y-3">
        {filtered.map((term) => {
          const Icon = term.icon
          const isOpen = expanded === term.id

          return (
            <div
              key={term.id}
              className={cn(
                'rounded-xl border bg-card transition-all duration-200',
                isOpen ? 'border-primary/30' : 'border-border'
              )}
            >
              <button
                className="w-full flex items-start gap-3 p-4 text-left"
                onClick={() => setExpanded(isOpen ? null : term.id)}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{term.term}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{term.simple}</p>
                </div>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                }
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{term.fullExplanation}</p>

                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">Exemplo prático:</p>
                    <p className="text-xs text-muted-foreground italic">{term.example}</p>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    {term.systemPath && term.systemPathHref && (
                      <Link to={term.systemPathHref} className="text-xs text-primary hover:underline flex items-center gap-1">
                        No sistema: {term.systemPath} →
                      </Link>
                    )}
                    {term.seeAlso && term.seeAlso.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">Ver também:</span>
                        {term.seeAlso.map((ref) => {
                          const refTerm = terms.find((t) => t.id === ref)
                          if (!refTerm) return null
                          return (
                            <button
                              key={ref}
                              onClick={() => setExpanded(ref)}
                              className="text-xs text-primary hover:underline"
                            >
                              {refTerm.term}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
