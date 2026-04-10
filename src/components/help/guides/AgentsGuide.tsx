import { Link } from 'react-router-dom'
import { WarningBox } from '../shared/WarningBox'
import { StepByStep } from '../shared/StepByStep'
import { Button } from '@/components/ui/button'
import { ArrowRight, Bot } from 'lucide-react'

interface AgentsGuideProps {
  subsection?: string
}

export function AgentsGuide({ subsection }: AgentsGuideProps) {
  if (subsection === 'create') return <AgentCreate />
  if (subsection === 'personality') return <AgentPersonality />
  if (subsection === 'rag') return <AgentRAG />
  if (subsection === 'errors') return <AgentErrors />
  return <AgentWhatIs />
}

function AgentWhatIs() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">O que é um Agente IA?</h1>
        <p className="text-muted-foreground">
          Entenda o conceito antes de criar o seu primeiro agente.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground mb-2">Definição simples</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Um Agente IA é como um <strong>atendente virtual especializado</strong>. Assim como
              uma empresa pode ter um atendente especialista em suporte técnico e outro em cobranças,
              você pode criar diferentes Agentes IA, cada um especializado em um assunto diferente.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            name: 'Agente Suporte Técnico',
            specialty: 'support',
            desc: 'Responde dúvidas sobre o sistema, erros, configurações, emissão de NF-e',
            color: 'bg-blue-50 border-blue-200',
            badge: 'bg-blue-100 text-blue-700',
          },
          {
            name: 'Agente Financeiro',
            specialty: 'financial',
            desc: 'Trata cobranças, inadimplência, negociações, boletos e pagamentos',
            color: 'bg-green-50 border-green-200',
            badge: 'bg-green-100 text-green-700',
          },
          {
            name: 'Agente Vendas',
            specialty: 'sales',
            desc: 'Qualifica leads, apresenta planos, agenda demonstrações',
            color: 'bg-purple-50 border-purple-200',
            badge: 'bg-purple-100 text-purple-700',
          },
          {
            name: 'Agente Triagem',
            specialty: 'triage',
            desc: 'Recebe todos os clientes e direciona para o agente correto',
            color: 'bg-amber-50 border-amber-200',
            badge: 'bg-amber-100 text-amber-700',
          },
        ].map((agent, i) => (
          <div key={i} className={`rounded-xl border p-4 ${agent.color}`}>
            <div className="flex items-start justify-between mb-2">
              <p className="font-semibold text-sm text-foreground">{agent.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agent.badge}`}>
                {agent.specialty}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{agent.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-3">Campos mais importantes de um agente</h3>
        <div className="space-y-2">
          {[
            { field: 'Nome', desc: 'Identifica o agente internamente e é lido pela IA de roteamento' },
            { field: 'Descrição', desc: 'CRÍTICO — a IA usa isso para decidir quando acionar este agente. Seja detalhado.' },
            { field: 'Especialidade', desc: 'Categoria do agente: support, financial, sales, triage, copilot ou analytics' },
            { field: 'System Prompt', desc: 'Instruções completas de personalidade, tom, limitações e comportamento da IA' },
            { field: 'Limite de Confiança', desc: 'Abaixo deste % de confiança, a conversa vai para um humano (padrão: 70%)' },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 py-1.5 border-b border-border/50 last:border-0">
              <span className="font-medium text-sm text-foreground min-w-[140px]">{item.field}</span>
              <span className="text-sm text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <Link to="/help/agents/create">
        <Button className="gap-2">
          Criar meu primeiro Agente <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  )
}

function AgentCreate() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Criando seu primeiro Agente IA</h1>
        <p className="text-muted-foreground">Siga este guia passo a passo para criar e configurar um agente.</p>
      </div>

      <StepByStep
        steps={[
          {
            title: 'Acesse a página de Agentes IA',
            description: (
              <span>No menu lateral, clique em <strong>Agentes IA</strong>. Na tela, clique no botão <strong>+ Novo Agente</strong>.</span>
            ),
            action: { label: 'Ir para Agentes IA', href: '/agents' },
          },
          {
            title: 'Preencha as informações básicas',
            description: (
              <ul className="space-y-1 mt-1">
                <li>• <strong>Nome:</strong> Seja específico (ex: "Agente Suporte NF-e", não "Agente 1")</li>
                <li>• <strong>Especialidade:</strong> Escolha a categoria correta</li>
                <li>• <strong>Descrição:</strong> Descreva detalhadamente o que este agente faz (campo mais importante!)</li>
              </ul>
            ),
            warning: 'Não deixe a Descrição vazia. A IA de roteamento usa este campo para decidir quando usar este agente.',
          },
          {
            title: 'Configure a personalidade',
            description: (
              <span>Na aba <strong>Personalidade</strong>, escreva as instruções do System Prompt. Aqui você define como o agente deve se comportar, que tom usar, o que pode ou não responder.</span>
            ),
          },
          {
            title: '(Opcional) Ative a Base de Conhecimento',
            description: (
              <span>Na aba <strong>Conhecimento</strong>, ative a opção "Buscar na Base de Conhecimento" para o agente consultar artigos antes de responder.</span>
            ),
          },
          {
            title: 'Vincule ao WhatsApp',
            description: (
              <span>Na aba <strong>Canais</strong>, selecione quais instâncias do WhatsApp este agente deve atender.</span>
            ),
          },
          {
            title: 'Ative e teste',
            description: (
              <span>Ative o agente pelo toggle na tela principal e use o <strong>Playground</strong> para testar conversas antes de colocar em produção.</span>
            ),
          },
        ]}
      />

      <WarningBox type="info" title="Dica de ouro">
        Use os <strong>Templates de Agente</strong> disponíveis na tela de criação para começar
        com configurações pré-definidas para suporte, financeiro ou vendas. Isso economiza muito
        tempo na configuração inicial.
      </WarningBox>
    </div>
  )
}

function AgentPersonality() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Configurando a Personalidade (System Prompt)</h1>
        <p className="text-muted-foreground">O System Prompt é o "manual de instruções" da sua IA.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-3">O que colocar no System Prompt?</h2>
        <div className="space-y-2">
          {[
            { section: 'Quem é a IA', example: '"Você é Ana, assistente virtual da empresa XYZ, especialista em suporte do sistema Sismais GL."' },
            { section: 'Como deve se comportar', example: '"Seja sempre cordial, use linguagem simples, responda de forma objetiva em no máximo 3 parágrafos."' },
            { section: 'O que pode e não pode responder', example: '"Responda apenas sobre o sistema Sismais GL. Para assuntos financeiros, diga que irá transferir para o setor financeiro."' },
            { section: 'Informações do negócio', example: '"A empresa atende de segunda a sexta das 8h às 18h. Suporte técnico: (11) 9999-9999."' },
            { section: 'Instruções específicas', example: '"Sempre pergunte o CNPJ do cliente antes de iniciar o atendimento."' },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs font-semibold text-foreground mb-1">Seção: {item.section}</p>
              <p className="text-xs text-muted-foreground italic">{item.example}</p>
            </div>
          ))}
        </div>
      </div>

      <WarningBox type="warning" title="System Prompt vazio = comportamento imprevisível">
        Se o System Prompt estiver vazio, a IA usará apenas o contexto da conversa para responder,
        sem nenhuma instrução específica do seu negócio. O resultado pode ser respostas
        genéricas ou incorretas para o seu contexto.
      </WarningBox>
    </div>
  )
}

function AgentRAG() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Conectando à Base de Conhecimento (RAG)</h1>
        <p className="text-muted-foreground">Como fazer a IA consultar seus artigos antes de responder.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-3">Como o RAG funciona?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          RAG significa "busca inteligente nos artigos". Quando ativado, antes de responder,
          a IA procura artigos na Base de Conhecimento que sejam relevantes para a pergunta do
          cliente, e usa essas informações para dar uma resposta mais precisa.
        </p>
        <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-2">
          <p>1. Cliente pergunta: <em>"Como emitir nota fiscal em contingência?"</em></p>
          <p>2. Sistema busca artigos sobre: "nota fiscal contingência emissão"</p>
          <p>3. Encontra artigo: "Emissão em Contingência — Manual Sismais GL"</p>
          <p>4. IA usa o artigo para responder com precisão</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold text-foreground mb-2">Configurações importantes do RAG</h2>
        <div className="space-y-2">
          <div className="flex gap-3 p-3 rounded-lg border border-border/50">
            <div className="flex-1">
              <p className="font-medium text-sm">Limite de Similaridade (padrão: 75%)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quão similar o artigo precisa ser para ser usado. Se aumentar demais (ex: 95%),
                quase nenhum artigo será encontrado.
              </p>
            </div>
          </div>
          <div className="flex gap-3 p-3 rounded-lg border border-border/50">
            <div className="flex-1">
              <p className="font-medium text-sm">Quantidade de artigos (padrão: 5)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quantos artigos são buscados por resposta. Mais artigos = mais contexto,
                mas pode deixar as respostas mais lentas.
              </p>
            </div>
          </div>
        </div>
      </div>

      <WarningBox type="warning" title="RAG ativo mas sem artigos = sem efeito">
        Se você ativar o RAG no agente mas a Base de Conhecimento estiver vazia ou com
        poucos artigos, o agente responderá normalmente sem consultar nenhum documento.
        Adicione artigos em <strong>Conhecimento</strong> no menu lateral.
      </WarningBox>
    </div>
  )
}

function AgentErrors() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">⚠️ Erros Comuns ao Configurar Agentes</h1>
        <p className="text-muted-foreground">Problemas frequentes e como evitá-los.</p>
      </div>

      <div className="space-y-4">
        {[
          {
            type: 'error' as const,
            title: 'Agente com Descrição vazia',
            problem: 'O sistema de roteamento IA não sabe quando usar este agente.',
            solution: 'Preencha a Descrição com os temas que o agente cobre e palavras que os clientes costumam usar.',
          },
          {
            type: 'error' as const,
            title: 'System Prompt vazio',
            problem: 'A IA não tem instruções sobre como se comportar, resultando em respostas genéricas.',
            solution: 'Escreva pelo menos: quem é a IA, que tom deve usar e quais assuntos deve/não deve responder.',
          },
          {
            type: 'warning' as const,
            title: 'Limite de Confiança = 0',
            problem: 'A IA nunca escalará para um humano, mesmo quando não souber a resposta.',
            solution: 'Configure o Limite de Confiança entre 60% e 80% para garantir escalação quando necessário.',
          },
          {
            type: 'warning' as const,
            title: 'RAG ativado mas Limite de Similaridade muito alto (acima de 90%)',
            problem: 'Nenhum artigo será encontrado na maioria das buscas, mesmo com artigos na base.',
            solution: 'Mantenha o Limite de Similaridade entre 70% e 80% para bom equilíbrio.',
          },
          {
            type: 'warning' as const,
            title: 'Agente não vinculado a nenhuma instância WhatsApp',
            problem: 'O agente existe mas não recebe mensagens de nenhum número.',
            solution: 'Na aba Canais do agente, selecione as instâncias WhatsApp que ele deve atender.',
          },
        ].map((item, i) => (
          <WarningBox key={i} type={item.type} title={item.title}>
            <p><strong>Problema:</strong> {item.problem}</p>
            <p className="mt-1"><strong>Solução:</strong> {item.solution}</p>
          </WarningBox>
        ))}
      </div>
    </div>
  )
}
