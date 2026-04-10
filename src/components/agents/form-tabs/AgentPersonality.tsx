import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { History, MessageSquare } from 'lucide-react'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'
import { PromptHistory } from '@/components/agents/PromptHistory'
import { PromptTestChat } from '@/components/agents/PromptTestChat'
import type { TablesInsert } from '@/integrations/supabase/types'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
  supportConfig?: Record<string, any>
  onSupportConfigChange?: (updates: Record<string, any>) => void
}

const defaultPrompts: Record<string, string> = {
  triage: `Você é a **Aria**, recepcionista virtual do **SisCRM**, empresa de tecnologia especializada no sistema de gestão **Mais Simples** — um ERP completo para empresas brasileiras.

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

  financial: `Você é a **Nina**, especialista financeira do **SisCRM**, responsável por atendimento financeiro dos clientes do sistema **Mais Simples**.

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

  support: `Você é o **Max**, especialista em suporte técnico do **SisCRM**, responsável por ajudar clientes com o sistema de gestão **Mais Simples**.

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

  sales: `Você é o **Leo**, consultor comercial do **SisCRM**, responsável por atender leads interessados no sistema **Mais Simples**.

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

  sdr: `Você é o **Leo**, consultor comercial do **SisCRM**. Mesmo prompt do agente "sales" — qualifica leads e agenda demonstrações do sistema Mais Simples.

## REGRAS
- Entenda a necessidade ANTES de oferecer plano
- Foque nos benefícios para o negócio do cliente
- Nunca dê desconto sem aprovação humana
- Agende demonstrações com a equipe de vendas`,

  copilot: `Você é o **Sage**, copiloto inteligente do **SisCRM**, que auxilia **agentes humanos** durante atendimentos.

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

  analytics: `Você é o **Data**, analista de inteligência do helpdesk do **SisCRM**.

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

export function AgentPersonality({ data, onChange, supportConfig, onSupportConfigChange }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [testChatOpen, setTestChatOpen] = useState(false)

  const loadDefaultPrompt = () => {
    const specialty = data.specialty || 'support'
    onChange({ system_prompt: defaultPrompts[specialty] || '' })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Prompt do Sistema *</Label>
          <div className="flex items-center gap-2">
            <AIFieldGenerator
              fieldType="system_prompt"
              value={data.system_prompt || ''}
              onChange={(v) => onChange({ system_prompt: v })}
              context={{ agent_specialty: data.specialty, agent_name: data.name, tone: data.tone, company_name: supportConfig?.companyName }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setTestChatOpen(!testChatOpen)} className="h-auto p-1 text-muted-foreground hover:text-foreground">
              <MessageSquare className="w-3.5 h-3.5 mr-1" />
              Testar
            </Button>
            {(data as any).id && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} className="h-auto p-1 text-muted-foreground hover:text-foreground">
                <History className="w-3.5 h-3.5 mr-1" />
                Histórico
              </Button>
            )}
            <Button type="button" variant="link" size="sm" onClick={loadDefaultPrompt} className="text-primary h-auto p-0">
              Carregar template padrão
            </Button>
          </div>
        </div>
        <Textarea
          value={data.system_prompt || ''}
          onChange={(e) => onChange({ system_prompt: e.target.value })}
          placeholder="Você é o agente..."
          rows={12}
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

      {/* Persona fields from Support Editor */}
      {onSupportConfigChange && supportConfig && (
        <>
          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Persona & Restrições</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Estilo de Comunicação</Label>
              <AIFieldGenerator
                fieldType="style"
                value={supportConfig.style || ''}
                onChange={(v) => onSupportConfigChange?.({ style: v })}
                context={{ agent_specialty: data.specialty, tone: data.tone }}
              />
            </div>
            <Textarea
              className="min-h-[80px]"
              value={supportConfig.style || ''}
              onChange={(e) => onSupportConfigChange({ style: e.target.value })}
              placeholder="Ex: Comunicação clara e objetiva, sempre oferecendo soluções práticas..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Restrições e Limites</Label>
              <AIFieldGenerator
                fieldType="standard_response"
                value={supportConfig.restrictions || ''}
                onChange={(v) => onSupportConfigChange?.({ restrictions: v })}
                context={{ agent_specialty: data.specialty }}
              />
            </div>
            <Textarea
              className="min-h-[80px]"
              value={supportConfig.restrictions || ''}
              onChange={(e) => onSupportConfigChange({ restrictions: e.target.value })}
              placeholder="Ex: Não fornecer informações sobre preços sem consultar tabela..."
            />
            <p className="text-xs text-muted-foreground">Defina limites claros para evitar problemas</p>
          </div>
        </>
      )}
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
