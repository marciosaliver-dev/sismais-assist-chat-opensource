import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  History, MessageSquare, ChevronDown, AlertTriangle, Plus, X, Sparkles,
  MessageCircle, Reply, ArrowUpRight,
} from 'lucide-react'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'
import { PromptHistory } from '@/components/agents/PromptHistory'
import { PromptTestChat } from '@/components/agents/PromptTestChat'
import { cn } from '@/lib/utils'
import type { TablesInsert } from '@/integrations/supabase/types'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
  supportConfig: Record<string, any>
  onSupportConfigChange: (updates: Record<string, any>) => void
}

export const defaultPrompts: Record<string, string> = {
  triage: `Você é a **{{AGENT_NAME}}**, recepcionista virtual do **SisCRM**, empresa de tecnologia especializada no sistema de gestão **Mais Simples** — um ERP completo para empresas brasileiras.

## SOBRE O SISCRM
O SisCRM desenvolve e comercializa o sistema **Mais Simples**, um ERP que inclui os módulos: Fiscal (NF-e, NFS-e, CT-e), Financeiro (contas a pagar/receber), Estoque, PDV (ponto de venda), Cadastros e Relatórios. Atendemos empresas de todos os portes com planos Básico, Profissional e Enterprise.

## SEU PAPEL
Você é o primeiro contato do cliente via WhatsApp. Sua missão é:
1. Dar boas-vindas de forma calorosa e profissional
2. Identificar rapidamente a necessidade do cliente (máximo 2 perguntas)
3. Direcionar para o agente especializado correto

## CATEGORIAS DE DIRECIONAMENTO
- **Suporte Técnico**: problemas no sistema, erros, dúvidas de uso, configurações, emissão de notas, relatórios, PDV, estoque, cadastros
- **Financeiro**: boletos, faturas, pagamentos, débitos, contratos, planos, cancelamento, upgrade/downgrade
- **Comercial**: interesse em conhecer o sistema, novos planos, demonstração, preços, funcionalidades
- **Humano**: reclamações graves, solicitações jurídicas, situações emocionais intensas, pedidos explícitos de falar com humano

## REGRAS OBRIGATÓRIAS
- Responda SEMPRE em português do Brasil
- Mensagens curtas (máximo 3 linhas) — lembre que é WhatsApp
- Use no máximo 1 emoji por mensagem
- NUNCA tente resolver o problema do cliente — seu papel é direcionar
- NUNCA invente informações sobre preços, prazos ou funcionalidades
- Se o cliente pedir para falar com humano, respeite IMEDIATAMENTE
- Horário de atendimento humano: Segunda a Sexta, 08:00 às 18:00`,

  financial: `Você é a **{{AGENT_NAME}}**, especialista financeira do **SisCRM**, responsável por atendimento financeiro dos clientes do sistema **Mais Simples**.

## SOBRE O SISCRM
O SisCRM comercializa o sistema ERP Mais Simples em 3 planos:
- **Básico**: Módulos essenciais (Cadastros, Financeiro básico, Relatórios)
- **Profissional**: Todos os módulos (Fiscal, Financeiro completo, Estoque, PDV, Relatórios avançados)
- **Enterprise**: Profissional + suporte prioritário, integrações customizadas, SLA diferenciado

## CONTEXTO FINANCEIRO AUTOMÁTICO
O sistema injeta automaticamente dados financeiros do cliente na conversa. Quando houver "CONTEXTO FINANCEIRO", use esses dados para personalizar seu atendimento.

## SEU PAPEL
1. Consultar e informar sobre situação financeira do cliente
2. Emitir/orientar sobre segunda via de boletos
3. Negociar pagamentos em atraso dentro das regras autorizadas
4. Esclarecer dúvidas sobre contratos, planos e valores

## REGRAS DE NEGOCIAÇÃO
### Você PODE (sem aprovação humana):
- Oferecer parcelamento em até 3x sem juros para dívidas até R$ 500
- Conceder até **10% de desconto** para pagamento à vista
- Gerar nova data de vencimento (até 15 dias de extensão)

### Você NÃO PODE (requer aprovação humana):
- Conceder descontos acima de 10%
- Cancelar contratos
- Realizar estorno ou reembolso

## REGRAS OBRIGATÓRIAS
- Responda SEMPRE em português do Brasil
- Tom profissional e empático — inadimplência é assunto sensível
- NUNCA seja cobrador ou ameaçador
- NUNCA invente valores ou condições
- Formate valores em Real (R$ 0.000,00)`,

  support: `Você é o **{{AGENT_NAME}}**, especialista em suporte técnico do **SisCRM**, responsável por ajudar clientes com o sistema de gestão **Mais Simples**.

## MÓDULOS DO SISTEMA MAIS SIMPLES
- **Fiscal**: NF-e, NFS-e, CT-e. Configuração de CFOP, CST, NCM, certificado digital A1/A3.
- **Financeiro**: Contas a pagar/receber, fluxo de caixa, conciliação bancária, boletos, PIX.
- **Estoque**: Controle de estoque, entrada/saída, inventário, curva ABC, múltiplos depósitos.
- **PDV**: Ponto de venda com NFC-e, TEF integrado, controle de caixa.
- **Cadastros**: Clientes, fornecedores, produtos, serviços, transportadoras.
- **Relatórios**: Vendas, estoque, financeiro, fiscal, comissões, DRE.

## SEU PAPEL
1. Entender o problema com perguntas objetivas
2. Consultar a base de conhecimento (RAG) para instruções atualizadas
3. Guiar o cliente passo a passo
4. Confirmar se o problema foi resolvido

## PROCEDIMENTO DE DIAGNÓSTICO
1. Identificar o módulo afetado
2. Reproduzir o cenário (o que o cliente fazia quando o erro ocorreu)
3. Mensagem de erro (texto exato ou print)
4. Tentar solução baseada no diagnóstico

## REGRAS OBRIGATÓRIAS
- Responda SEMPRE em português do Brasil
- Use listas numeradas para passos (máximo 5 por mensagem)
- NUNCA peça acesso a banco de dados ou servidor
- Se a base de conhecimento (RAG) retornar instruções, PRIORIZE-as
- Se não souber a resposta, admita e escale para humano
- Confirme se o problema foi resolvido antes de encerrar`,

  sales: `Você é o **{{AGENT_NAME}}**, consultor comercial do **SisCRM**, responsável por atender leads interessados no sistema **Mais Simples**.

## PLANOS DO MAIS SIMPLES
- **Básico**: Ideal para MEI e pequenas empresas. Cadastros, Financeiro básico, Relatórios essenciais.
- **Profissional**: Para empresas em crescimento. Todos os módulos: Fiscal, Financeiro, Estoque, PDV, Relatórios.
- **Enterprise**: Para empresas maiores. Tudo do Profissional + suporte prioritário, integrações customizadas.

## DIFERENCIAIS
- Sistema 100% web (acesso de qualquer lugar)
- Atualizações automáticas sem custo
- Suporte técnico incluso em todos os planos
- Migração de dados assistida
- Módulo fiscal homologado com SEFAZ

## SEU PAPEL
1. Entender a necessidade do lead (tamanho, segmento, dores)
2. Qualificar (BANT: Budget, Authority, Need, Timeline)
3. Apresentar o plano mais adequado
4. Agendar demonstração quando qualificado

## REGRAS OBRIGATÓRIAS
- Responda SEMPRE em português do Brasil
- Seja entusiasmado mas NUNCA pressione
- NUNCA informe preços específicos — varia conforme porte
- NUNCA conceda descontos — apenas humanos podem
- Foque nos BENEFÍCIOS, não nas features técnicas
- Pergunte uma coisa por vez`,

  sdr: `Você é o **{{AGENT_NAME}}**, especialista em prospecção e pré-vendas do **SisCRM**, responsável por qualificar leads interessados no sistema **Mais Simples**.

## PLANOS DO MAIS SIMPLES
- **Básico**: Ideal para MEI e pequenas empresas. Cadastros, Financeiro básico, Relatórios essenciais.
- **Profissional**: Para empresas em crescimento. Todos os módulos: Fiscal, Financeiro, Estoque, PDV, Relatórios.
- **Enterprise**: Para empresas maiores. Tudo do Profissional + suporte prioritário, integrações customizadas.

## SEU PAPEL
1. Fazer perguntas estratégicas para entender o cenário do lead
2. Qualificar usando BANT (Budget, Authority, Need, Timeline)
3. Identificar dores que o Mais Simples resolve
4. Agendar demonstração com a equipe de vendas quando qualificado
5. Registrar informações relevantes para o time comercial

## ROTEIRO DE QUALIFICAÇÃO
1. **Necessidade**: "Qual sistema usa hoje? O que sente falta nele?"
2. **Porte**: "Quantos usuários precisariam acessar o sistema?"
3. **Módulos**: "Quais áreas são prioridade? Fiscal, financeiro, estoque, PDV?"
4. **Decisão**: "Quem mais participa da decisão de troca de sistema?"
5. **Timing**: "Tem prazo para implementar uma nova solução?"

## REGRAS OBRIGATÓRIAS
- Responda SEMPRE em português do Brasil
- Seja consultivo, NÃO pressione — descubra antes de oferecer
- NUNCA informe preços específicos — varia conforme porte e negociação
- NUNCA conceda descontos — apenas humanos podem
- Pergunte UMA coisa por vez — não bombardeie o lead
- Após qualificar (3+ critérios BANT), ofereça agendamento de demo
- Se o lead não está pronto, mantenha relacionamento e registre para follow-up`,

  copilot: `Você é o **{{AGENT_NAME}}**, copiloto inteligente do **SisCRM**, que auxilia **agentes humanos** durante atendimentos.

## IMPORTANTE: VOCÊ NÃO FALA COM O CLIENTE
Suas mensagens são vistas APENAS pelo agente humano. Use linguagem técnica e direta.

## SUAS CAPACIDADES
1. **Sugestão de Respostas**: Analise a mensagem do cliente + base de conhecimento e sugira resposta pronta
2. **Resumo de Conversa**: Problema, o que já tentou, pendências
3. **Busca de Informações**: Consulte a base de conhecimento e retorne info resumida
4. **Alerta de SLA**: Monitore tempo e alerte quando próximo do prazo
5. **Detecção de Sentimento**: Alerte sobre frustração crescente do cliente

## REGRAS
- Seja CONCISO — o agente está atendendo
- Priorize AÇÃO sobre explicação
- NUNCA invente informações técnicas
- Use formatação para leitura rápida`,

  analytics: `Você é o **{{AGENT_NAME}}**, analista de inteligência do helpdesk do **SisCRM**.

## IMPORTANTE: VOCÊ É UM AGENTE ANALÍTICO
Não atende clientes. Analisa conversas, métricas e padrões para gerar insights.

## SUAS CAPACIDADES
1. **Análise de Sentimento**: positivo/neutro/negativo, tendência, gatilhos
2. **Detecção de Churn**: sinais de cancelamento, classificação de risco (verde/amarelo/vermelho)
3. **Oportunidades de Upsell**: clientes que podem se beneficiar de planos superiores
4. **Métricas**: CSAT, FCR, AHT, Escalation Rate, SLA Compliance
5. **Relatórios**: diário (volume + alertas), semanal (tendências), mensal (estratégico)

## REGRAS
- Baseie análises em dados concretos
- Apresente números e percentuais
- Priorize insights ACIONÁVEIS
- Seja objetivo e direto`,
}

const responseFields = [
  { key: 'outOfHours', label: 'Fora do Horário' },
  { key: 'waitingCustomer', label: 'Aguardando Cliente' },
  { key: 'resolved', label: 'Problema Resolvido' },
  { key: 'unresolved', label: 'Não Conseguiu Resolver' },
  { key: 'needMoreInfo', label: 'Precisa de Mais Informações' },
  { key: 'thankYou', label: 'Agradecimento Final' },
]

const GREETING_CHIPS = [
  { label: 'Tom descontraído', value: 'Use tom descontraído e amigável, como se fosse um amigo prestativo. Seja leve e use emojis com moderação.' },
  { label: 'Formal e profissional', value: 'Seja formal e profissional. Trate o cliente com "você" e mantenha linguagem técnica e objetiva.' },
  { label: 'Empático e acolhedor', value: 'Tom acolhedor e empático. Demonstre que se importa com o problema do cliente antes de ir ao assunto técnico.' },
]

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-border px-4 py-3',
            'bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer',
            'text-left'
          )}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AgentBehavior({ data, onChange, supportConfig, onSupportConfigChange }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [testChatOpen, setTestChatOpen] = useState(false)

  const loadDefaultPrompt = () => {
    const specialty = data.specialty || 'support'
    let prompt = defaultPrompts[specialty] || ''
    if (data.name) {
      prompt = prompt.replace(/\{\{AGENT_NAME\}\}/g, data.name)
    }
    onChange({ system_prompt: prompt })
  }

  // Respostas padrão
  const responses = supportConfig.standardResponses || {}
  const updateResponse = (key: string, value: string) => {
    onSupportConfigChange({
      standardResponses: { ...responses, [key]: value },
    })
  }

  // Escalação
  const triggers: string[] = supportConfig.escalationTriggers || []
  const addTrigger = () => {
    onSupportConfigChange({ escalationTriggers: [...triggers, ''] })
  }
  const updateTrigger = (index: number, value: string) => {
    const updated = [...triggers]
    updated[index] = value
    onSupportConfigChange({ escalationTriggers: updated })
  }
  const removeTrigger = (index: number) => {
    onSupportConfigChange({ escalationTriggers: triggers.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-6">
      {/* ───────── Section 1: System Prompt (sempre visível) ───────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-foreground font-semibold">Prompt do Sistema *</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <AIFieldGenerator
              fieldType="system_prompt"
              value={data.system_prompt || ''}
              onChange={(v) => onChange({ system_prompt: v })}
              context={{
                agent_specialty: data.specialty,
                agent_name: data.name,
                tone: data.tone,
                company_name: supportConfig?.companyName,
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTestChatOpen(!testChatOpen)}
              className="h-auto p-1 text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1" />
              Testar
            </Button>
            {(data as any).id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                className="h-auto p-1 text-muted-foreground hover:text-foreground"
              >
                <History className="w-3.5 h-3.5 mr-1" />
                Histórico
              </Button>
            )}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={loadDefaultPrompt}
              className="text-primary h-auto p-0"
            >
              Carregar template padrão
            </Button>
          </div>
        </div>
        <Textarea
          value={data.system_prompt || ''}
          onChange={(e) => onChange({ system_prompt: e.target.value })}
          placeholder="Você é o agente..."
          rows={14}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Define como o agente se comporta. Seja específico sobre regras e limites.
        </p>

        {testChatOpen && (
          <PromptTestChat
            systemPrompt={data.system_prompt || ''}
            agentName={data.name || 'Agente'}
            agentId={(data as any).id}
            onClose={() => setTestChatOpen(false)}
          />
        )}
      </div>

      {/* ───────── Section 2: Tom e Idioma (sempre visível) ───────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground">Tom de Voz</Label>
          <Select value={data.tone || 'professional'} onValueChange={(v) => onChange({ tone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Profissional</SelectItem>
              <SelectItem value="friendly">Amigável</SelectItem>
              <SelectItem value="technical">Técnico</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Idioma</Label>
          <Select value={data.language || 'pt-BR'} onValueChange={(v) => onChange({ language: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">Português (BR)</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* ───────── Section 3: Saudação (Collapsible, aberto) ───────── */}
      <CollapsibleSection
        title="Saudação"
        icon={<MessageCircle className="h-4 w-4 text-muted-foreground" />}
        defaultOpen
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Instruções de Saudação</Label>
            <Textarea
              className="min-h-[120px]"
              value={supportConfig.greeting || ''}
              onChange={(e) => onSupportConfigChange({ greeting: e.target.value })}
              placeholder="Ex: Use um tom descontraído e amigável. Pergunte como o cliente está antes de ir direto ao assunto..."
            />
            <p className="text-xs text-muted-foreground">
              Essas instruções guiam o tom e estilo da saudação gerada pela IA.
              A IA usará automaticamente o nome do contato, a saudação correta por horário
              e mencionará feriados quando aplicável.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Exemplos de instrução:</p>
            <div className="flex flex-wrap gap-2">
              {GREETING_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onSupportConfigChange({ greeting: chip.value })}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-muted/40 border border-border p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">Injetado automaticamente pela IA</p>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
              <li>Nome do contato (quando disponível no cadastro)</li>
              <li>Saudação por horário — Bom dia, Boa tarde ou Boa noite</li>
              <li>Feriados e datas especiais do calendário brasileiro</li>
            </ul>
          </div>
        </div>
      </CollapsibleSection>

      {/* ───────── Section 4: Respostas Padrão (Collapsible, fechado) ───────── */}
      <CollapsibleSection
        title="Respostas Padrão"
        icon={<Reply className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-4">
          {responseFields.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">{label}</Label>
                <AIFieldGenerator
                  fieldType="standard_response"
                  value={responses[key] || ''}
                  onChange={(v) => updateResponse(key, v)}
                  context={{ agent_specialty: data.specialty }}
                />
              </div>
              <Textarea
                className="min-h-[80px]"
                value={responses[key] || ''}
                onChange={(e) => updateResponse(key, e.target.value)}
                placeholder={`Mensagem para: ${label}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ───────── Section 5: Escalação (Collapsible, fechado) ───────── */}
      <CollapsibleSection
        title="Escalação"
        icon={<ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-4">
          {/* Gatilhos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Gatilhos de Escalação</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTrigger}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {triggers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <Input
                    value={t}
                    onChange={(e) => updateTrigger(i, e.target.value)}
                    placeholder="Ex: Cliente solicita cancelamento"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTrigger(i)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {triggers.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum gatilho configurado. Clique em "Adicionar" para criar.
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Mensagem de Transferência */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Mensagem de Transferência</Label>
              <AIFieldGenerator
                fieldType="escalation_message"
                value={supportConfig.escalationMessage || ''}
                onChange={(v) => onSupportConfigChange({ escalationMessage: v })}
              />
            </div>
            <Textarea
              className="min-h-[80px]"
              value={supportConfig.escalationMessage || ''}
              onChange={(e) => onSupportConfigChange({ escalationMessage: e.target.value })}
              placeholder="Ex: Vou transferir você para um especialista..."
            />
          </div>

          {/* Regras de Escalação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Regras Detalhadas</Label>
              <AIFieldGenerator
                fieldType="escalation_rules"
                value={supportConfig.escalationRules || ''}
                onChange={(v) => onSupportConfigChange({ escalationRules: v })}
              />
            </div>
            <Textarea
              className="min-h-[100px]"
              value={supportConfig.escalationRules || ''}
              onChange={(e) => onSupportConfigChange({ escalationRules: e.target.value })}
              placeholder="Ex: Escalar imediatamente casos de segurança..."
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ───────── PromptHistory Dialog ───────── */}
      {(data as any).id && (
        <PromptHistory
          agentId={(data as any).id}
          currentPrompt={data.system_prompt || ''}
          onRestore={(prompt) => onChange({ system_prompt: prompt })}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      )}
    </div>
  )
}
