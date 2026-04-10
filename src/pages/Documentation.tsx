import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, Cpu, Settings, Footprints, Sparkles, ArrowRight, Cog, Receipt, Webhook } from 'lucide-react'

const sections = [
  { id: 'visao-geral', label: '1. Visão Geral', icon: BookOpen },
  { id: 'motores-ia', label: '2. Os 5 Motores de IA', icon: Cpu },
  { id: 'configurar-agente', label: '3. Configurar Agente', icon: Settings },
  { id: 'passo-a-passo', label: '4. Guia Passo a Passo', icon: Footprints },
  { id: 'experiencia-cliente', label: '5. Experiência do Cliente', icon: Sparkles },
  { id: 'fluxo-completo', label: '6. Fluxo de Mensagem', icon: ArrowRight },
  { id: 'configuracoes-globais', label: '7. Config. Globais', icon: Cog },
  { id: 'webhook-cobranca', label: '8. Webhook de Cobrança', icon: Receipt },
  { id: 'ia-configuradora', label: '9. IA Configuradora', icon: Sparkles },
  { id: 'webhooks-entrada', label: '10. Webhooks de Entrada', icon: Webhook },
]

function Documentation() {
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = contentRef.current
    if (!container) return
    const handleScroll = () => {
      const headings = container.querySelectorAll('h2[id]')
      let current = sections[0].id
      headings.forEach((h) => {
        const el = h as HTMLElement
        if (el.offsetTop - container.scrollTop <= 120) {
          current = el.id
        }
      })
      setActiveSection(current)
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* TOC Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-4 hidden lg:block">
        <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Índice</h3>
        <nav className="space-y-1">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  'w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg transition-colors',
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 prose prose-sm dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-th:text-foreground prose-td:text-muted-foreground">

          <h1 className="text-2xl font-bold text-foreground border-b border-border pb-4 mb-8">
            📘 PRD — Sistema de Agentes de IA | SisCRM
          </h1>

          {/* Section 1 */}
          <SectionVisaoGeral />

          {/* Section 2 */}
          <SectionMotoresIA />

          {/* Section 3 */}
          <SectionConfigurarAgente />

          {/* Section 4 */}
          <SectionPassoAPasso />

          {/* Section 5 */}
          <SectionExperienciaCliente />

          {/* Section 6 */}
          <SectionFluxoCompleto />

          {/* Section 7 */}
          <SectionConfiguracoesGlobais />

          {/* Section 8 */}
          <SectionWebhookCobranca />

          {/* Section 9 */}
          <SectionIAConfiguradora />

          {/* Section 10 */}
          <SectionWebhooksEntrada />

          <div className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground">
            SisCRM — Documentação v1.1
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Section Components ─── */

function SectionVisaoGeral() {
  return (
    <>
      <h2 id="visao-geral" className="scroll-mt-8">1. Visão Geral do Sistema</h2>
      <p>
        O SisCRM possui um ecossistema completo de Inteligência Artificial composto por <strong>5 microsserviços</strong> que trabalham em cadeia para processar, rotear, responder e aprender com cada interação de cliente via WhatsApp.
      </p>
      <pre className="text-xs leading-relaxed"><code>{`+------------------+     +---------------+     +--------------+     +------------------+
| Mensagem chega   | --> | 1. Analyzer   | --> | 2. Orchestr.  | --> | 3. Executor      |
| (WhatsApp)       |     | (Analisa)     |     | (Roteia)      |     | (Responde)       |
+------------------+     +---------------+     +--------------+     +------------------+
                                                                           |
                         +---------------+     +------------------+        |
                         | 5. Copiloto   |     | 4. Learning Loop | <------+
                         | (Atendente)   |     | (Aprende)        |
                         +---------------+     +------------------+`}</code></pre>
    </>
  )
}

function SectionMotoresIA() {
  return (
    <>
      <h2 id="motores-ia" className="scroll-mt-8">2. Os 5 Motores de IA</h2>

      <h3>2.1. Message Analyzer (Analisador de Mensagens)</h3>
      <p><strong>O que faz:</strong> Primeira etapa do pipeline. Recebe cada mensagem do cliente e extrai metadados inteligentes.</p>
      <p><strong>Dados extraídos:</strong></p>
      <ul>
        <li><strong>Sentimento:</strong> positivo, neutro ou negativo</li>
        <li><strong>Urgência:</strong> low, medium, high ou critical</li>
        <li><strong>Intenção:</strong> billing_question, technical_support, complaint, password_reset, etc.</li>
        <li><strong>Palavras-chave:</strong> termos relevantes da mensagem</li>
        <li><strong>Categoria sugerida:</strong> financial, support, sales ou triage</li>
        <li><strong>Embedding vetorial:</strong> representação numérica da mensagem para busca semântica (RAG)</li>
      </ul>
      <p><strong>Modelo usado:</strong> GPT-4o Mini via OpenRouter (rápido e barato para classificação)</p>

      <h3>2.2. Orchestrator (Orquestrador Inteligente)</h3>
      <p><strong>O que faz:</strong> Recebe a análise do Analyzer e decide qual agente de IA deve responder. Não usa regras manuais — a própria IA decide comparando a mensagem com a descrição de cada agente.</p>
      <p><strong>Lógica de decisão:</strong></p>
      <ul>
        <li>Lê a <strong>descrição</strong> e <strong>especialidade</strong> de todos os agentes ativos</li>
        <li>Prioriza manter o mesmo agente se a conversa já está em andamento</li>
        <li>Se nenhum agente se encaixa, escalona para atendente humano</li>
        <li>Se houve 3+ trocas de agente na mesma conversa, escalona automaticamente</li>
      </ul>
      <p><strong>Modelo usado:</strong> Gemini 2.0 Flash Lite (ultra-rápido, temperatura 0.1 para decisões determinísticas)</p>

      <h3>2.3. Agent Executor (Executor de Agentes)</h3>
      <p><strong>O que faz:</strong> Executa o agente selecionado — monta o prompt completo, busca na base de conhecimento (RAG), chama ferramentas (tools) se necessário e gera a resposta.</p>
      <p><strong>Pipeline de execução:</strong></p>
      <ol>
        <li>Carrega configuração completa do agente (system_prompt, tom, temperatura, etc.)</li>
        <li>Busca últimas 10 mensagens da conversa (histórico)</li>
        <li>Se RAG habilitado: busca documentos similares na base de conhecimento via embedding</li>
        <li>Monta prompt = system_prompt + contexto RAG + histórico + mensagem atual</li>
        <li>Se agente tem ferramentas (tools): envia como function_calling</li>
        <li>Chama o modelo LLM configurado no agente</li>
        <li>Calcula nível de confiança da resposta</li>
        <li>Se confiança {"<"} threshold: escalona para humano ao invés de responder</li>
        <li>Salva a resposta e atualiza métricas</li>
      </ol>
      <p><strong>Modelo usado:</strong> Configurável por agente (padrão: GPT-5 Mini)</p>

      <h3>2.4. Learning Loop (Ciclo de Aprendizado)</h3>
      <p><strong>O que faz:</strong> Ajusta automaticamente o nível de confiança dos agentes com base em feedbacks implícitos e explícitos.</p>
      <table>
        <thead><tr><th>Sinal</th><th>Efeito</th><th>Ajuste</th></tr></thead>
        <tbody>
          <tr><td>Escalação para humano</td><td>IA falhou</td><td>+5% threshold (mais cauteloso)</td></tr>
          <tr><td>CSAT ≥ 4 estrelas</td><td>IA acertou</td><td>-2% threshold (mais autônomo)</td></tr>
          <tr><td>CSAT {"<"} 4 estrelas</td><td>IA errou</td><td>+3% threshold</td></tr>
          <tr><td>Palavras positivas</td><td>Cliente satisfeito</td><td>-2% threshold</td></tr>
        </tbody>
      </table>
      <p><strong>Resultado:</strong> Com o tempo, agentes bons ficam mais autônomos e agentes fracos escalonam mais rápido.</p>

      <h3>2.5. Copilot (Copiloto do Atendente)</h3>
      <p><strong>O que faz:</strong> Quando a conversa está sendo atendida por um humano, a IA atua como copiloto sugerindo respostas e fornecendo análises.</p>
      <ul>
        <li>Sugere respostas editáveis baseadas no contexto</li>
        <li>Gera resumo automático da conversa</li>
        <li>Detecta sentimento e urgência em tempo real</li>
        <li>Busca na base de conhecimento (RAG) para embasar sugestões</li>
        <li>Sugere prioridade do ticket com justificativa</li>
        <li>Suporta áudio transcrito e imagens como contexto</li>
      </ul>
    </>
  )
}

function SectionConfigurarAgente() {
  return (
    <>
      <h2 id="configurar-agente" className="scroll-mt-8">3. Como Configurar um Agente de IA</h2>
      <p>Menu lateral → <strong>Agentes</strong> → botão <strong>"+ Novo Agente"</strong></p>
      <p>O formulário possui <strong>13 abas</strong> organizadas em duas seções:</p>

      <h3>3.1. Seção "Configuração IA" (7 abas)</h3>

      <h4>Aba 1 — Básico</h4>
      <ul>
        <li><strong>Nome do Agente:</strong> Nome identificador (ex: "Ana - Suporte Técnico")</li>
        <li><strong>Especialidade:</strong> Triagem, Financeiro, Suporte Técnico, Vendas ou Análise</li>
        <li><strong>Descrição:</strong> CAMPO MAIS IMPORTANTE — é o que a IA usa para decidir quando acionar este agente</li>
        <li><strong>Cor:</strong> Cor visual do agente no sistema</li>
        <li><strong>Prioridade (0-100):</strong> Agentes com maior número são avaliados primeiro pelo orquestrador</li>
      </ul>

      <h4>Aba 2 — Modelo IA</h4>
      <table>
        <thead><tr><th>Categoria</th><th>Modelos</th><th>Custo Aprox.</th></tr></thead>
        <tbody>
          <tr><td>Rápido e Barato</td><td>Gemini 3 Flash, GPT-5 Mini</td><td>~R$0.001-0.002/msg</td></tr>
          <tr><td>Equilibrado</td><td>Gemini 2.5 Flash, Claude 3 Haiku</td><td>~R$0.003/msg</td></tr>
          <tr><td>Premium</td><td>GPT-5, Gemini 2.5 Pro</td><td>~R$0.015-0.020/msg</td></tr>
          <tr><td>Personalizado</td><td>Qualquer modelo OpenRouter</td><td>Variável</td></tr>
        </tbody>
      </table>

      <h4>Aba 3 — Prompt</h4>
      <ul>
        <li><strong>System Prompt:</strong> Instruções detalhadas de comportamento. Há templates padrão por especialidade.</li>
        <li><strong>Tom de Voz:</strong> Profissional, Amigável, Técnico ou Casual</li>
        <li><strong>Idioma:</strong> Português (BR), English ou Español</li>
        <li><strong>Restrições e Limites:</strong> O que o agente NÃO deve fazer</li>
      </ul>

      <h4>Aba 4 — Ferramentas (Tools)</h4>
      <p>Selecione quais funções externas o agente pode chamar (function calling). Cada ferramenta tem: nome, descrição, schema JSON de parâmetros. Tipos: API Call, Webhook.</p>

      <h4>Aba 5 — RAG (Base de Conhecimento)</h4>
      <ul>
        <li><strong>Habilitar RAG:</strong> Liga/desliga a busca na base de conhecimento</li>
        <li><strong>Top K Documentos:</strong> Quantos documentos retornar por consulta (1-10)</li>
        <li><strong>Threshold de Similaridade:</strong> Precisão mínima para incluir documento (50%-95%)</li>
        <li><strong>Filtro por Categoria:</strong> faq, tutorial, troubleshooting, policy</li>
        <li><strong>Filtro por Tags:</strong> Tags específicas para restringir busca</li>
      </ul>

      <h4>Aba 6 — Roteamento</h4>
      <p>Exibe como a IA vê este agente (nome, especialidade, descrição). Mostra outros agentes ativos para comparação. Não requer configuração manual — o orquestrador decide automaticamente.</p>

      <h4>Aba 7 — Canais</h4>
      <p>Selecione em quais instâncias WhatsApp este agente está ativo. Instâncias sem agente vinculado direcionam para fila humana.</p>

      <h3>3.2. Seção "Atendimento" (6 abas)</h3>

      <h4>Aba 8 — Briefing</h4>
      <p>Nome da Empresa, Descrição, Produtos/Serviços, Público-Alvo.</p>

      <h4>Aba 9 — Saudação</h4>
      <p>Mensagem inicial que o agente usa ao começar uma conversa.</p>

      <h4>Aba 10 — Diagnóstico</h4>
      <p>Lista de Perguntas de Diagnóstico + Problemas Comuns com soluções (pares problema/solução).</p>

      <h4>Aba 11 — Escalação</h4>
      <ul>
        <li><strong>Gatilhos de Escalação:</strong> situações em que o agente DEVE transferir para humano</li>
        <li><strong>Mensagem de Transferência:</strong> o que dizer ao transferir</li>
        <li><strong>Regras Detalhadas:</strong> regras customizadas de escalação</li>
      </ul>

      <h4>Aba 12 — Políticas</h4>
      <p>Horário de Atendimento, SLA, Política de Garantia, Política de Reembolso.</p>

      <h4>Aba 13 — Respostas</h4>
      <p>Templates de respostas padrão: Fora do Horário, Aguardando Cliente, Problema Resolvido, Não Conseguiu Resolver, Precisa de Mais Informações, Agradecimento Final.</p>

      <h3>3.3. IA Configuradora (Atalho)</h3>
      <p>O botão <strong>"Configurar com IA"</strong> abre o <strong>PlatformAIAssistant</strong> — um assistente unificado baseado no <strong>Gemini 2.5 Pro</strong> que configura a plataforma inteira via conversa em linguagem natural.</p>
      <p>Além de agentes, a IA Configuradora também pode gerar configurações de <strong>webhooks de entrada</strong> e <strong>automações</strong>. Veja a <strong>Seção 9</strong> para detalhes completos.</p>
    </>
  )
}

function SectionPassoAPasso() {
  return (
    <>
      <h2 id="passo-a-passo" className="scroll-mt-8">4. Guia Passo a Passo</h2>

      <h3>Passo 1: Criar a Base de Conhecimento</h3>
      <p>Antes de criar agentes, alimente a base de conhecimento:</p>
      <ul>
        <li>Menu <strong>Conhecimento</strong> → <strong>Upload</strong> de documentos (PDF, TXT, URLs)</li>
        <li>Categorize: FAQ, Tutorial, Troubleshooting, Policy</li>
        <li>Adicione tags para filtrar por agente</li>
      </ul>

      <h3>Passo 2: Criar o Agente de Triagem (Recomendado)</h3>
      <ul>
        <li>Especialidade: <strong>Triagem</strong></li>
        <li>Descrição: "Recebe o primeiro contato do cliente, entende a necessidade e direciona para o agente especializado correto"</li>
        <li>Prioridade: <strong>100</strong> (mais alta, é avaliado primeiro)</li>
        <li>System Prompt: Instruir para ser breve, fazer no máximo 2 perguntas e direcionar</li>
      </ul>

      <h3>Passo 3: Criar Agentes Especializados</h3>
      <ul>
        <li><strong>Suporte Técnico:</strong> Resolve problemas do sistema. Habilite RAG com filtro "troubleshooting"</li>
        <li><strong>Financeiro:</strong> Consulta débitos, gera boletos. Configure ferramentas (tools) para consultar APIs</li>
        <li><strong>Vendas:</strong> Qualifica leads, apresenta planos. Temperatura um pouco maior (0.5)</li>
      </ul>

      <h3>Passo 4: Configurar RAG por Agente</h3>
      <ul>
        <li>Habilite RAG em cada agente</li>
        <li>Use filtros de categoria para restringir: Suporte = troubleshooting+faq, Financeiro = policy, Vendas = faq</li>
        <li>Ajuste threshold: 75% é um bom equilíbrio</li>
      </ul>

      <h3>Passo 5: Vincular Canais WhatsApp</h3>
      <p>Na aba Canais, selecione as instâncias WhatsApp onde cada agente atua. Um agente pode atuar em múltiplas instâncias.</p>

      <h3>Passo 6: Testar no Playground</h3>
      <p>Menu <strong>Playground</strong> → selecione o agente → simule conversas. O playground mostra: modelo usado, documentos RAG encontrados, confiança, custo por mensagem.</p>

      <h3>Passo 7: Ativar em Produção</h3>
      <p>Marque o agente como <strong>Ativo</strong>. Mensagens reais começam a ser processadas pelo pipeline automático.</p>
    </>
  )
}

function SectionExperienciaCliente() {
  return (
    <>
      <h2 id="experiencia-cliente" className="scroll-mt-8">5. Como Criar uma Experiência Única para o Cliente</h2>

      <h3>5.1. Personalização pelo System Prompt</h3>
      <ul>
        <li>Dê um nome humano ao agente ("Olá! Sou a Ana, sua assistente")</li>
        <li>Defina regras de linguagem ("Use emojis moderadamente", "Tuteie o cliente")</li>
        <li>Estabeleça limites claros ("Nunca prometa desconto sem aprovação")</li>
      </ul>

      <h3>5.2. Contexto Automático do Cliente</h3>
      <p>O sistema automaticamente enriquece o prompt com dados do CRM: nome do cliente e empresa, produto assinado, plano ativo do contrato.</p>

      <h3>5.3. Base de Conhecimento (RAG)</h3>
      <p>Alimente com FAQ, tutoriais e troubleshooting do seu produto. A IA busca automaticamente e inclui no contexto.</p>

      <h3>5.4. Escalação Humanizada</h3>
      <p>Configure gatilhos e mensagens de transferência: "Entendo que esse assunto é mais delicado. Vou conectar você com um especialista..."</p>

      <h3>5.5. Respostas Padrão para Momentos-Chave</h3>
      <p>Configure templates para fora do horário, resolução, aguardando cliente, etc.</p>

      <h3>5.6. Aprendizado Contínuo</h3>
      <p>O Learning Loop ajusta automaticamente: agentes com elogios ficam mais autônomos, agentes que escalonam muito ficam mais cautelosos.</p>

      <h3>5.7. Copiloto para Atendimento Híbrido</h3>
      <p>A IA sugere respostas, gera resumos automáticos e indica prioridade e sentimento do cliente.</p>

      <h3>5.8. Múltiplos Agentes Trabalhando Juntos</h3>
      <p>O orquestrador inteligente permite: Triagem → Suporte → Humano, ou redirecionamento automático entre especialidades.</p>
    </>
  )
}

function SectionFluxoCompleto() {
  return (
    <>
      <h2 id="fluxo-completo" className="scroll-mt-8">6. Fluxo Completo de uma Mensagem</h2>
      <ol>
        <li>Cliente envia mensagem no WhatsApp</li>
        <li>Webhook recebe e salva no banco</li>
        <li>Message Analyzer extrai: sentimento, intenção, urgência, embedding</li>
        <li>Orchestrator compara com descrições dos agentes e escolhe o melhor</li>
        <li>Agent Executor:
          <ol type="a">
            <li>Carrega system_prompt + support_config do agente</li>
            <li>Busca histórico da conversa (últimas 10 msgs)</li>
            <li>Busca documentos na base de conhecimento (RAG)</li>
            <li>Enriquece com dados do CRM do cliente</li>
            <li>Chama o modelo LLM</li>
            <li>Calcula confiança da resposta</li>
            <li>Se confiança ≥ threshold: envia resposta</li>
            <li>Se confiança {"<"} threshold: escalona para humano</li>
          </ol>
        </li>
        <li>Resposta é enviada ao cliente via WhatsApp (UAZAPI)</li>
        <li>Learning Loop registra feedback e ajusta thresholds</li>
        <li>Automações e fluxos são disparados (se configurados)</li>
      </ol>
    </>
  )
}

function SectionConfiguracoesGlobais() {
  return (
    <>
      <h2 id="configuracoes-globais" className="scroll-mt-8">7. Configurações Globais</h2>
      <p>No menu <strong>Configurações de IA</strong> (<code>/ai-settings</code>), você pode ajustar:</p>
      <ul>
        <li>Ativar/desativar respostas automáticas globalmente</li>
        <li>Definir agente padrão (fallback)</li>
        <li>Configurar modelos para Resumo, Transcrição, Copiloto e Agentes</li>
        <li>Ajustar parâmetros globais (max_tokens, idioma)</li>
      </ul>
      <p>Em <strong>Configurações → Atendimento</strong>, também é possível:</p>
      <ul>
        <li><strong>Agente padrão de cobranças:</strong> Define qual atendente humano recebe automaticamente todos os tickets gerados pelo webhook de cobrança, incluindo notificação de alta prioridade</li>
      </ul>
    </>
  )
}

function SectionWebhookCobranca() {
  return (
    <>
      <h2 id="webhook-cobranca" className="scroll-mt-8">8. Webhook de Cobrança</h2>

      <h3>8.1. Objetivo</h3>
      <p>Processar automaticamente eventos de inadimplência vindos de plataformas externas (<strong>Asaas</strong>, <strong>Eduzz</strong>, <strong>Guru</strong>) e criar/gerenciar tickets de cobrança no helpdesk.</p>

      <h3>8.2. Como Configurar</h3>
      <ol>
        <li>Acesse <strong>Configurações → Integrações e Webhooks</strong></li>
        <li>Clique em <strong>"Novo Webhook de Entrada"</strong></li>
        <li>Na aba <strong>"Templates"</strong>, selecione <strong>"Cobrança"</strong></li>
        <li>Salve e copie a URL gerada</li>
        <li>Configure a URL na sua plataforma de cobrança (Asaas, Eduzz, etc.) como endpoint de webhook</li>
      </ol>

      <h3>8.3. Payload Esperado</h3>
      <table>
        <thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
        <tbody>
          <tr><td><code>cliente_nome</code></td><td>string</td><td>✅</td><td>Nome do cliente</td></tr>
          <tr><td><code>cliente_documento</code></td><td>string</td><td>✅</td><td>CPF/CNPJ</td></tr>
          <tr><td><code>cliente_telefone</code></td><td>string</td><td>✅</td><td>Telefone com DDD</td></tr>
          <tr><td><code>cliente_email</code></td><td>string</td><td>—</td><td>E-mail do cliente</td></tr>
          <tr><td><code>plataforma</code></td><td>string</td><td>✅</td><td>asaas, eduzz ou guru</td></tr>
          <tr><td><code>evento</code></td><td>string</td><td>✅</td><td>Tipo do evento (ex: PAYMENT_OVERDUE)</td></tr>
          <tr><td><code>fatura_id</code></td><td>string</td><td>✅</td><td>ID único da fatura (para deduplicação)</td></tr>
          <tr><td><code>id_externo</code></td><td>string</td><td>—</td><td>ID do cliente na plataforma</td></tr>
          <tr><td><code>valor</code></td><td>number</td><td>—</td><td>Valor da fatura</td></tr>
          <tr><td><code>vencimento</code></td><td>string</td><td>—</td><td>Data de vencimento</td></tr>
          <tr><td><code>descricao</code></td><td>string</td><td>—</td><td>Descrição adicional</td></tr>
          <tr><td><code>contrato_id</code></td><td>string</td><td>—</td><td>ID do contrato</td></tr>
        </tbody>
      </table>

      <h3>8.4. Deduplicação por Fatura</h3>
      <p>O sistema utiliza o campo <code>id_fatura</code> (gravado na conversa) para garantir <strong>idempotência</strong>:</p>
      <ul>
        <li>Se já existe um ticket <strong>aberto</strong> com o mesmo <code>id_fatura</code>, o sistema <strong>não cria um novo ticket</strong> — apenas adiciona uma nota interna com os dados atualizados</li>
        <li>Se o ticket existente estiver em <strong>outro board</strong>, ele é automaticamente movido para o board "Gestão de Cobranças"</li>
        <li>Os campos <code>id_contrato</code> e <code>id_fatura</code> ficam gravados na conversa para rastreabilidade</li>
      </ul>

      <h3>8.5. Agente Padrão de Cobranças</h3>
      <p>Em <strong>Configurações → Atendimento</strong>, é possível definir um agente humano padrão que:</p>
      <ul>
        <li>Recebe automaticamente todos os tickets gerados pelo webhook de cobrança</li>
        <li>Recebe notificação de <strong>alta prioridade</strong> a cada novo ticket</li>
      </ul>

      <h3>8.6. Fluxo Completo</h3>
      <pre className="text-xs leading-relaxed"><code>{`Plataforma (Asaas/Eduzz) --> webhook-receiver --> webhook-billing
                                                      |
                                      +---------------+---------------+
                                      |               |               |
                                Deduplicar      Mover ticket     Criar ticket
                                (por fatura)    (p/ board        (novo, board
                                                 cobrança)        cobrança)
                                      |               |               |
                                      +-------+-------+-------+-------+
                                              |               |
                                        Notificar        Gravar log
                                        agente           auditoria`}</code></pre>
    </>
  )
}

function SectionIAConfiguradora() {
  return (
    <>
      <h2 id="ia-configuradora" className="scroll-mt-8">9. IA Configuradora Unificada</h2>

      <h3>9.1. O que é</h3>
      <p>O <strong>PlatformAIAssistant</strong> é um assistente de IA baseado no <strong>Gemini 2.5 Pro</strong> que configura a plataforma inteira via conversa em linguagem natural. Ele entende o contexto completo do SisCRM e pode gerar configurações estruturadas para agentes, webhooks e automações.</p>

      <h3>9.2. Onde Acessar</h3>
      <p>O botão <strong>"Configurar com IA"</strong> (ícone ✨) está disponível em:</p>
      <ul>
        <li><strong>Tela de Agentes:</strong> Ao criar ou editar um agente — a IA preenche todos os 13 campos automaticamente</li>
        <li><strong>Tela de Integrações:</strong> Ao lado do botão "Novo Webhook" — a IA gera a configuração do webhook</li>
        <li><strong>Tela de Automações:</strong> Para criar automações — a IA sugere triggers, filtros e ações</li>
      </ul>

      <h3>9.3. Contextos de Uso</h3>
      <table>
        <thead><tr><th>Contexto</th><th>Comportamento</th></tr></thead>
        <tbody>
          <tr><td><code>agent</code></td><td>Foca em configurar agentes de IA (prompt, modelo, RAG, tools, etc.)</td></tr>
          <tr><td><code>webhook</code></td><td>Foca em configurar webhooks de entrada (plataforma, mapeamento, template)</td></tr>
          <tr><td><code>automation</code></td><td>Foca em criar automações (triggers, condições, ações)</td></tr>
          <tr><td><code>general</code></td><td>Modo livre — responde dúvidas e ajuda com qualquer configuração</td></tr>
        </tbody>
      </table>

      <h3>9.4. Tools Disponíveis</h3>
      <p>A IA utiliza <strong>tool calling</strong> para gerar configurações estruturadas:</p>
      <table>
        <thead><tr><th>Tool</th><th>Descrição</th></tr></thead>
        <tbody>
          <tr><td><code>generate_agent_config</code></td><td>Gera configuração completa de agente IA</td></tr>
          <tr><td><code>generate_webhook_config</code></td><td>Gera configuração de webhook de entrada</td></tr>
          <tr><td><code>generate_automation_config</code></td><td>Gera sugestão de automação com trigger e ações</td></tr>
          <tr><td><code>query_platform_data</code></td><td>Consulta boards, stages, agentes e categorias existentes</td></tr>
        </tbody>
      </table>

      <h3>9.5. Fluxo de Uso</h3>
      <ol>
        <li>Clique em <strong>"Configurar com IA"</strong></li>
        <li>Descreva o que deseja em linguagem natural (ex: "Quero um agente de suporte técnico que consulte minha base de FAQ")</li>
        <li>A IA faz perguntas para refinar os detalhes</li>
        <li>A IA gera a configuração completa e exibe para revisão</li>
        <li>Revise e aplique a configuração gerada</li>
      </ol>
    </>
  )
}

function SectionWebhooksEntrada() {
  return (
    <>
      <h2 id="webhooks-entrada" className="scroll-mt-8">10. Webhooks de Entrada (Templates)</h2>

      <h3>10.1. Sistema de Templates</h3>
      <p>O sistema de webhooks de entrada suporta <strong>templates pré-configurados</strong> que facilitam a integração com plataformas externas:</p>
      <table>
        <thead><tr><th>Template</th><th>Descrição</th><th>Ações Pré-configuradas</th></tr></thead>
        <tbody>
          <tr><td><strong>Genérico</strong></td><td>Webhook sem pré-configuração, totalmente customizável</td><td>Nenhuma</td></tr>
          <tr><td><strong>Notificação</strong></td><td>Recebe alertas e cria conversas automaticamente</td><td>Criar conversa + notificar</td></tr>
          <tr><td><strong>Cobrança</strong></td><td>Integração com plataformas de pagamento</td><td>Mapear cliente + criar conversa no board de cobrança</td></tr>
        </tbody>
      </table>

      <h3>10.2. Template de Cobrança</h3>
      <p>O template "Cobrança" pré-configura:</p>
      <ul>
        <li><strong>template_type:</strong> <code>billing</code> — identifica o webhook para roteamento especial</li>
        <li><strong>action_mode:</strong> <code>direct</code> — executa ações imediatamente ao receber o payload</li>
        <li><strong>Ações:</strong> <code>map_client_fields</code> + <code>create_conversation</code></li>
      </ul>
      <p><strong>Mapeamento de campos pré-definido:</strong></p>
      <table>
        <thead><tr><th>Campo do Payload</th><th>Campo do Sistema</th></tr></thead>
        <tbody>
          <tr><td><code>cliente_nome</code></td><td><code>helpdesk_clients.name</code></td></tr>
          <tr><td><code>cliente_documento</code></td><td><code>helpdesk_clients.cnpj</code></td></tr>
          <tr><td><code>cliente_telefone</code></td><td><code>helpdesk_clients.phone</code></td></tr>
          <tr><td><code>cliente_email</code></td><td><code>helpdesk_clients.email</code></td></tr>
        </tbody>
      </table>

      <h3>10.3. Como Criar</h3>
      <ol>
        <li>Acesse <strong>Configurações → Integrações e Webhooks</strong></li>
        <li>Clique em <strong>"Novo Webhook de Entrada"</strong></li>
        <li>Na aba <strong>"Templates"</strong>, selecione o template desejado</li>
        <li>Os campos serão preenchidos automaticamente</li>
        <li>Personalize o nome e ajuste os campos se necessário</li>
        <li>Salve e copie a URL gerada para usar na plataforma externa</li>
      </ol>

      <h3>10.4. Roteamento Especial</h3>
      <p>Quando o <code>webhook-receiver</code> detecta que o webhook possui <code>template_type = 'billing'</code>, ele <strong>redireciona automaticamente</strong> o payload para a Edge Function <code>webhook-billing</code>, que executa toda a lógica especializada de deduplicação, classificação e notificação.</p>
    </>
  )
}

export default Documentation
