import { WarningBox } from '../shared/WarningBox'
import { StepByStep } from '../shared/StepByStep'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface AutomationsGuideProps {
  subsection?: string
}

export function AutomationsGuide({ subsection }: AutomationsGuideProps) {
  if (subsection === 'triggers') return <AutomationsTriggers />
  if (subsection === 'actions') return <AutomationsActions />
  if (subsection === 'duplicates') return <AutomationsDuplicates />
  return <AutomationsDifference />
}

function AutomationsDifference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Automações vs Flow Builder</h1>
        <p className="text-muted-foreground">Entenda a diferença entre os dois sistemas e quando usar cada um.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">A</span>
            </div>
            <div>
              <p className="font-semibold text-sm">Automações</p>
              <p className="text-xs text-muted-foreground">Sistema legado (simples)</p>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>✓ Simples de configurar</li>
            <li>✓ Ideal para ações únicas</li>
            <li>✓ Ex: enviar mensagem quando nova conversa</li>
            <li>• Interface básica em lista</li>
            <li>• Menos flexível para fluxos complexos</li>
          </ul>
          <Link to="/automations">
            <Button size="sm" variant="outline" className="mt-4 w-full text-xs">Gerenciar Automações</Button>
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">F</span>
            </div>
            <div>
              <p className="font-semibold text-sm">Flow Builder</p>
              <p className="text-xs text-muted-foreground">Sistema visual (avançado)</p>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>✓ Editor visual drag-and-drop</li>
            <li>✓ Fluxos condicionais (if/else)</li>
            <li>✓ Múltiplas ações em sequência</li>
            <li>✓ Recomendado para novos fluxos</li>
            <li>• Curva de aprendizado maior</li>
          </ul>
          <Link to="/flow-builder">
            <Button size="sm" variant="outline" className="mt-4 w-full text-xs">Abrir Flow Builder</Button>
          </Link>
        </div>
      </div>

      <WarningBox type="warning" title="Risco de mensagens duplicadas">
        Se você tiver uma Automação <strong>E</strong> um Flow Builder com o <strong>mesmo gatilho
        (trigger)</strong> ambos ativos, o sistema pode disparar os dois ao mesmo tempo, e
        o cliente receberá duas mensagens. Veja como resolver em{' '}
        <Link to="/help/automations/duplicates" className="underline font-medium">Respostas Duplicadas</Link>.
      </WarningBox>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-3">Quando usar cada um</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="font-medium text-blue-600 min-w-[100px]">Automações:</span>
            <span className="text-muted-foreground">Tarefas simples como "ao receber primeira mensagem, enviar boas-vindas"</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-purple-600 min-w-[100px]">Flow Builder:</span>
            <span className="text-muted-foreground">Fluxos com condições: "se cliente for do plano Premium, enviar mensagem A, senão enviar mensagem B"</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AutomationsTriggers() {
  const triggers = [
    { id: 'message_received', label: 'Mensagem recebida', desc: 'Dispara quando o cliente envia qualquer mensagem' },
    { id: 'conversation_created', label: 'Nova conversa', desc: 'Dispara quando uma nova conversa é iniciada' },
    { id: 'conversation_assigned', label: 'Conversa atribuída', desc: 'Dispara quando a conversa é atribuída a um agente' },
    { id: 'conversation_resolved', label: 'Conversa resolvida', desc: 'Dispara quando uma conversa é marcada como resolvida' },
    { id: 'ticket_created', label: 'Ticket criado', desc: 'Dispara quando um novo ticket é criado no Kanban' },
    { id: 'ticket_status_changed', label: 'Status do ticket alterado', desc: 'Dispara quando o status de um ticket muda' },
    { id: 'scheduled', label: 'Agendado (cron)', desc: 'Dispara em horários programados (ex: todos os dias às 9h)' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Gatilhos (Triggers) Disponíveis</h1>
        <p className="text-muted-foreground">Lista dos eventos que podem disparar uma automação ou fluxo.</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">GATILHO</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">QUANDO DISPARA</th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{t.id}</code>
                  <p className="font-medium text-sm mt-1">{t.label}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{t.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WarningBox type="info" title="Gatilhos no Flow Builder vs Automações">
        Ambos os sistemas usam os mesmos tipos de gatilho. O risco é ter dois fluxos/automações
        com o mesmo gatilho ativos ao mesmo tempo — isso causa duplicatas.
      </WarningBox>
    </div>
  )
}

function AutomationsActions() {
  const actions = [
    { id: 'send_message', label: 'Enviar mensagem', desc: 'Envia uma mensagem de texto para o cliente via WhatsApp' },
    { id: 'assign_agent', label: 'Atribuir agente', desc: 'Atribui a conversa a um agente humano específico' },
    { id: 'assign_ai_agent', label: 'Atribuir agente IA', desc: 'Atribui a conversa a um Agente IA específico' },
    { id: 'add_tag', label: 'Adicionar tag', desc: 'Adiciona uma tag/etiqueta à conversa' },
    { id: 'create_ticket', label: 'Criar ticket', desc: 'Cria um ticket no Kanban' },
    { id: 'update_ticket_status', label: 'Atualizar status do ticket', desc: 'Muda o status de um ticket existente' },
    { id: 'wait', label: 'Aguardar (delay)', desc: 'Pausa o fluxo por um tempo determinado antes da próxima ação' },
    { id: 'condition', label: 'Condição (if/else)', desc: 'Divide o fluxo baseado em uma condição (apenas no Flow Builder)' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Ações Disponíveis</h1>
        <p className="text-muted-foreground">O que suas automações e fluxos podem fazer.</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">AÇÃO</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">O QUE FAZ</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{a.id}</code>
                  <p className="font-medium text-sm mt-1">{a.label}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{a.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AutomationsDuplicates() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">⚠️ Como Evitar Respostas Duplicadas</h1>
        <p className="text-muted-foreground">Por que acontece e como resolver.</p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-800 mb-3">Por que acontece?</h2>
        <p className="text-sm text-red-700 mb-3">
          O sistema tem dois mecanismos de automação independentes: <strong>Automações</strong> (menu Automações)
          e <strong>Flow Builder</strong>. Se ambos tiverem um fluxo ativo para o mesmo gatilho
          (ex: <code>message_received</code>), os dois disparam ao mesmo tempo.
        </p>
        <p className="text-sm text-red-700">
          Resultado: o cliente recebe <strong>duas mensagens de boas-vindas</strong> ou duas respostas
          para a mesma pergunta.
        </p>
      </div>

      <StepByStep
        steps={[
          {
            title: 'Identifique quais fluxos têm o mesmo gatilho',
            description: (
              <span>
                Acesse <strong>Automações</strong> e <strong>Flow Builder</strong> separadamente.
                Anote quais estão ativos e qual gatilho cada um usa.
              </span>
            ),
          },
          {
            title: 'Escolha qual manter',
            description: 'Para novos fluxos, prefira o Flow Builder (mais flexível). Desative a automação legada equivalente.',
          },
          {
            title: 'Desative o duplicado',
            description: 'No sistema que você não vai usar, desative o fluxo pelo toggle na listagem. Não precisa deletar — apenas desativar resolve o conflito.',
          },
          {
            title: 'Teste',
            description: 'Use a página de Teste do WhatsApp para enviar uma mensagem de teste e verificar se o cliente recebe apenas uma resposta.',
            action: { label: 'Painel de Teste', href: '/whatsapp-test-panel' },
          },
        ]}
      />
    </div>
  )
}
