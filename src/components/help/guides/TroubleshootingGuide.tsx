import { WarningBox } from '../shared/WarningBox'
import { StepByStep } from '../shared/StepByStep'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface TroubleshootingGuideProps {
  subsection?: string
}

export function TroubleshootingGuide({ subsection }: TroubleshootingGuideProps) {
  if (subsection === 'wrong-answers') return <TroubleshootWrongAnswers />
  if (subsection === 'duplicate') return <TroubleshootDuplicate />
  return <TroubleshootNotResponding />
}

function TroubleshootNotResponding() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">🔍 IA não está respondendo</h1>
        <p className="text-muted-foreground">Siga este checklist sistemático para diagnosticar o problema.</p>
      </div>

      <StepByStep
        steps={[
          {
            title: 'Verifique a instância WhatsApp',
            description: (
              <span>Acesse <strong>WhatsApp</strong> no menu lateral. O status deve estar "Conectado" (verde). Se estiver desconectado, escaneie o QR Code novamente.</span>
            ),
            action: { label: 'Ver instâncias WhatsApp', href: '/whatsapp-instances' },
          },
          {
            title: 'Verifique se existe agente ativo',
            description: (
              <span>Acesse <strong>Agentes IA</strong>. Deve haver pelo menos um agente com o toggle "Ativo" ligado.</span>
            ),
            action: { label: 'Ver Agentes IA', href: '/agents' },
          },
          {
            title: 'Verifique se o agente tem descrição',
            description: 'Edite o agente e confirme que o campo Descrição está preenchido. Sem descrição, o sistema de roteamento pode não selecionar o agente.',
          },
          {
            title: 'Verifique se o agente está vinculado à instância',
            description: 'No agente, vá à aba Canais e confirme que a instância WhatsApp correta está selecionada.',
          },
          {
            title: 'Verifique a chave de API do LLM',
            description: (
              <span>Acesse <strong>Config. IA</strong> no menu. A chave da OpenRouter deve estar configurada e válida.</span>
            ),
            action: { label: 'Config. IA', href: '/ai-settings' },
          },
          {
            title: 'Se nada funcionou: verifique o Diagnóstico',
            description: 'O painel de diagnóstico verifica automaticamente os problemas mais comuns.',
            action: { label: 'Abrir Diagnóstico', href: '/help/diagnostic' },
          },
        ]}
      />
    </div>
  )
}

function TroubleshootWrongAnswers() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">🔍 IA está respondendo errado</h1>
        <p className="text-muted-foreground">Como diagnosticar e corrigir respostas incorretas.</p>
      </div>

      <div className="space-y-4">
        {[
          {
            problem: 'IA dá informações genéricas (não específicas do meu sistema)',
            cause: 'O RAG (busca na base de conhecimento) não está ativo, ou o Limite de Similaridade está muito alto.',
            solution: 'Ative o RAG no agente e verifique o Limite de Similaridade (recomendado: 75%). Adicione artigos específicos sobre seu produto.',
            href: '/help/knowledge',
          },
          {
            problem: 'IA usa tom errado ou é muito formal/informal',
            cause: 'O System Prompt não especifica o tom desejado.',
            solution: 'Edite o System Prompt do agente e adicione instruções sobre tom: "Use linguagem informal e amigável" ou "Seja sempre formal e profissional".',
            href: '/agents',
          },
          {
            problem: 'IA responde sobre assuntos que não deveria',
            cause: 'O System Prompt não tem limites claros sobre o que o agente pode/não pode responder.',
            solution: 'Adicione ao System Prompt: "Você só deve responder sobre [X]. Para outros assuntos, diga educadamente que não pode ajudar."',
            href: '/agents',
          },
          {
            problem: 'IA dá a mesma resposta genérica para tudo',
            cause: 'O agente pode estar recebendo um contexto confuso, ou o System Prompt é muito vago.',
            solution: 'Revise o System Prompt e adicione exemplos concretos de como responder. Considere ativar o RAG.',
            href: '/agents',
          },
          {
            problem: 'IA menciona concorrentes ou informações incorretas',
            cause: 'O modelo LLM usa conhecimento geral que pode incluir informações de terceiros.',
            solution: 'Adicione ao System Prompt: "Nunca mencione concorrentes. Foque apenas no [Nome da Empresa] e seus produtos."',
            href: '/agents',
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex gap-3 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="font-semibold text-sm">{item.problem}</p>
            </div>
            <div className="ml-7 space-y-1">
              <p className="text-xs text-muted-foreground">
                <strong>Causa provável:</strong> {item.cause}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Como corrigir:</strong> {item.solution}
              </p>
              <Link to={item.href} className="inline-block mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7">Corrigir agora</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TroubleshootDuplicate() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">🔍 Cliente recebendo respostas duplicadas</h1>
        <p className="text-muted-foreground">A causa mais comum e como resolver.</p>
      </div>

      <WarningBox type="error" title="Causa mais provável: dois sistemas disparando ao mesmo tempo">
        O sistema tem dois mecanismos de automação: <strong>Automações</strong> e <strong>Flow Builder</strong>.
        Se ambos tiverem um fluxo ativo para o mesmo gatilho (ex: "nova mensagem"), os dois
        dispararão simultaneamente e o cliente receberá duas mensagens.
      </WarningBox>

      <StepByStep
        steps={[
          {
            title: 'Liste todas as Automações ativas',
            description: (
              <span>Acesse <strong>Automações</strong> no menu. Anote o gatilho (trigger) de cada automação ativa.</span>
            ),
            action: { label: 'Ver Automações', href: '/automations' },
          },
          {
            title: 'Liste todos os Flows ativos',
            description: (
              <span>Acesse <strong>Flow Builder</strong> no menu. Anote o gatilho de cada flow ativo.</span>
            ),
            action: { label: 'Ver Flow Builder', href: '/flow-builder' },
          },
          {
            title: 'Identifique o gatilho duplicado',
            description: 'Compare as duas listas. Se aparecer o mesmo gatilho nos dois sistemas, esse é o problema.',
          },
          {
            title: 'Desative o duplicado',
            description: 'Escolha qual manter (recomendado: Flow Builder para novos fluxos) e desative o outro. Não precisa deletar — apenas desativar resolve.',
            warning: 'Nunca deixe dois fluxos/automações com o mesmo gatilho ambos ativos. Escolha sempre um.',
          },
          {
            title: 'Teste',
            description: (
              <span>
                Use o painel de teste para enviar uma mensagem e confirmar que agora chega apenas uma resposta.
              </span>
            ),
            action: { label: 'Painel de Teste', href: '/whatsapp-test-panel' },
          },
        ]}
      />
    </div>
  )
}
