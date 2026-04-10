import { Link } from 'react-router-dom'
import { WarningBox } from '../shared/WarningBox'
import { StepByStep } from '../shared/StepByStep'
import { Button } from '@/components/ui/button'
import { ArrowRight, Bot, GitBranch, AlertTriangle, CheckCircle, ArrowDown } from 'lucide-react'

interface RoutingGuideProps {
  subsection?: string
}

export function RoutingGuide({ subsection }: RoutingGuideProps) {
  if (subsection === 'improve') return <RoutingImprove />
  if (subsection === 'fallback') return <RoutingFallback />
  if (subsection === 'troubleshoot') return <RoutingTroubleshoot />
  return <RoutingHowItWorks />
}

function RoutingHowItWorks() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Como o sistema decide qual Agente responde</h1>
        <p className="text-muted-foreground">
          Entenda o mecanismo real de roteamento — é diferente do que você pode esperar.
        </p>
      </div>

      <WarningBox type="info" title="Roteamento por IA, não por regras manuais">
        Este sistema usa <strong>Inteligência Artificial para decidir</strong> qual agente deve
        responder cada mensagem — não existem regras manuais de palavras-chave que você
        precise cadastrar. O segredo é escrever boas descrições nos seus Agentes IA.
      </WarningBox>

      {/* Pipeline diagram */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-5">O caminho do roteamento</h2>
        <div className="flex flex-col items-center gap-2">
          {[
            { label: 'Mensagem do cliente chega', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'IA analisa: o que o cliente quer?', color: 'bg-purple-50 border-purple-200 text-purple-800' },
            { label: 'IA lê descrição e nome de cada Agente ativo', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
            { label: 'IA decide: qual agente é mais adequado?', color: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
            { label: 'Agente escolhido gera a resposta', color: 'bg-green-50 border-green-200 text-green-800' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center w-full max-w-sm">
              <div className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium text-center ${item.color}`}>
                {item.label}
              </div>
              {i < 4 && <ArrowDown className="w-4 h-4 text-muted-foreground my-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* What the AI reads */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-4">O que a IA lê para decidir</h2>
        <div className="space-y-3">
          {[
            {
              field: 'Nome do Agente',
              importance: 'Alta',
              example: '"Agente Financeiro" vs "Agente Suporte Técnico"',
              tip: 'Use nomes claros e específicos',
              color: 'text-red-600 bg-red-50',
            },
            {
              field: 'Descrição do Agente',
              importance: 'Crítica',
              example: '"Especialista em cobranças, inadimplência, boletos, pagamentos e negociações financeiras"',
              tip: 'Este é o campo mais importante! Seja específico sobre que tipo de perguntas o agente responde.',
              color: 'text-red-700 bg-red-100',
            },
            {
              field: 'Especialidade (Specialty)',
              importance: 'Média',
              example: 'financial, support, sales, triage',
              tip: 'Ajuda a categorizar o agente para a IA de roteamento',
              color: 'text-amber-600 bg-amber-50',
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{item.field}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.color}`}>
                    Importância: {item.importance}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  <strong>Exemplo:</strong> {item.example}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Dica:</strong> {item.tip}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <WarningBox type="warning" title="Sobre as 'Routing Rules' (Regras de Roteamento)">
        A tabela de Routing Rules existe no sistema, mas <strong>não afeta o comportamento atual
        do roteamento</strong>. O orquestrador usa IA para decidir, não regras manuais de
        palavras-chave. Se você configurou routing rules esperando que elas funcionem como filtros,
        esta funcionalidade pode ser implementada em versões futuras.
      </WarningBox>

      <div className="flex items-center justify-between pt-2">
        <Link to="/help/agents">
          <Button variant="outline" size="sm">← Agentes IA</Button>
        </Link>
        <Link to="/help/routing/improve">
          <Button size="sm" className="gap-2">
            Melhorando o roteamento <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function RoutingImprove() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Melhorando o Roteamento</h1>
        <p className="text-muted-foreground">
          Como fazer a IA escolher o agente certo com mais precisão.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground mb-4">A fórmula de uma boa descrição</h2>
        <p className="text-sm text-muted-foreground mb-4">
          A descrição do agente é o principal fator de decisão da IA. Use este modelo:
        </p>
        <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono leading-relaxed">
          <span className="text-green-600">[O que o agente faz]</span>
          {' + '}
          <span className="text-blue-600">[Temas que cobre]</span>
          {' + '}
          <span className="text-purple-600">[Palavras que os clientes usam]</span>
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700 mb-1">❌ Descrição ruim:</p>
            <p className="text-sm text-red-600">"Agente de suporte ao cliente"</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-semibold text-green-700 mb-1">✅ Descrição boa:</p>
            <p className="text-sm text-green-600">
              "Especialista em suporte técnico para o sistema Sismais GL. Responde dúvidas sobre
              emissão de notas fiscais, certificado digital, SEFAZ, rejeições de NF-e, configuração
              do PDV, e erros no sistema. Clientes costumam perguntar: 'nota fiscal rejeitada',
              'erro no certificado', 'como emitir NF-e', 'SEFAZ offline'."
            </p>
          </div>
        </div>
      </div>

      <StepByStep
        steps={[
          {
            title: 'Acesse a configuração do Agente',
            description: (
              <span>
                Vá em <strong>Agentes IA</strong> no menu lateral → clique no agente que deseja melhorar → botão Editar.
              </span>
            ),
            action: { label: 'Ir para Agentes IA', href: '/agents' },
          },
          {
            title: 'Edite a Descrição',
            description: 'Na aba "Configurações Básicas", encontre o campo Descrição. Escreva detalhadamente quais assuntos este agente domina e que palavras os clientes usam.',
            warning: 'Deixar a Descrição vazia faz com que a IA de roteamento tenha muito menos informações para decidir — o agente pode ser escolhido raramente ou de forma incorreta.',
          },
          {
            title: 'Verifique a Especialidade',
            description: 'Certifique-se de que a Especialidade (Specialty) está correta: "support" para suporte técnico, "financial" para cobranças, "sales" para vendas, etc.',
          },
          {
            title: 'Teste o roteamento',
            description: (
              <span>
                Use o Playground do agente para simular mensagens e verificar se o roteamento está correto.
              </span>
            ),
            action: { label: 'Abrir Playground', href: '/agents' },
          },
        ]}
      />
    </div>
  )
}

function RoutingFallback() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Fallback e Escalação para Humano</h1>
        <p className="text-muted-foreground">O que acontece quando a IA não sabe ou não consegue decidir.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Quando a conversa vai para um humano?</h2>
        {[
          { trigger: 'Confiança baixa', desc: 'A IA gerou uma resposta mas a confiança ficou abaixo do limite configurado (padrão: 70%). Configurável em cada agente no campo "Limite de Confiança".' },
          { trigger: 'Cliente pede humano', desc: 'O cliente diz palavras como "falar com atendente", "quero uma pessoa", "me transfere" — o sistema detecta e escala automaticamente.' },
          { trigger: 'Frustração extrema', desc: 'O analisador de sentimento detecta frustração severa na mensagem do cliente.' },
          { trigger: 'Múltiplas trocas de agente', desc: 'Se a mesma conversa trocou de agente 3 ou mais vezes sem resolução, o sistema escala para humano.' },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <CheckCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">{item.trigger}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold text-foreground">O que acontece se nenhum agente for escolhido?</h2>
        <p className="text-sm text-muted-foreground">
          Se a IA de roteamento não conseguir decidir com segurança qual agente usar, o sistema
          usa o agente com o menor número de <strong>Prioridade</strong> (campo numérico em cada agente —
          menor número = prioridade mais alta).
        </p>
        <WarningBox type="warning">
          Se você tem múltiplos agentes mas não configurou a Prioridade, o sistema pode escolher
          de forma imprevisível. Configure um agente como "agente padrão" com Prioridade = 1.
        </WarningBox>
      </div>
    </div>
  )
}

function RoutingTroubleshoot() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">⚠️ Agente não está respondendo?</h1>
        <p className="text-muted-foreground">Checklist de diagnóstico para resolver o problema.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3">
        <h2 className="font-semibold text-amber-800 mb-4">Verifique cada item abaixo</h2>
        {[
          { q: 'O agente está ativo?', how: 'Vá em Agentes IA → verifique se o toggle "Ativo" está ligado para o agente' },
          { q: 'A instância do WhatsApp está conectada?', how: 'Vá em WhatsApp → verifique se a instância mostra status "Conectado"' },
          { q: 'O agente tem uma descrição preenchida?', how: 'Edite o agente → aba Básico → verifique o campo Descrição' },
          { q: 'O agente está vinculado à instância correta?', how: 'Edite o agente → aba Canais → verifique se a instância WhatsApp está selecionada' },
          { q: 'O system prompt está preenchido?', how: 'Edite o agente → aba Personalidade → verifique o campo System Prompt' },
          { q: 'A chave de API do modelo LLM está configurada?', how: 'Vá em Config. IA → verifique se a chave OpenRouter está ativa' },
        ].map((item, i) => (
          <div key={i} className="flex gap-3 bg-white/60 rounded-lg p-3 border border-amber-200/60">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-amber-900">{item.q}</p>
              <p className="text-xs text-amber-700 mt-0.5">Como verificar: {item.how}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link to="/help/diagnostic">
          <Button variant="outline" className="gap-2">
            <Bot className="w-4 h-4" />
            Abrir diagnóstico automático
          </Button>
        </Link>
        <Link to="/agents">
          <Button className="gap-2">
            Gerenciar Agentes <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
