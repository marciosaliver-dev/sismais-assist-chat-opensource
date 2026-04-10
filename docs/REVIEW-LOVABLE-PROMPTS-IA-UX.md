# Review Completo: Prompts Lovable + 5 Ideias IA Autonoma + UX/UI

> Analise completa de 29 paginas, 44+ edge functions e todos os componentes do Sismais Assist Chat.
> Data: 01/03/2026

---

# PARTE 1 — PROMPTS PARA O LOVABLE

## BLOCO A — Consistencia Global (aplicar em todo o projeto)

---

### PROMPT A1 — Substituir todos os `confirm()` por AlertDialog

```
Em todo o projeto React, substitua todos os usos de `confirm()` (window.confirm / confirm nativo do browser) por um componente shadcn/ui AlertDialog consistente.

Arquivos afetados: Knowledge.tsx, Agents.tsx, Automations.tsx e qualquer outro que use `confirm(` nas acoes de deletar.

Padrao a usar:
- Criar um componente reutilizavel `<ConfirmDialog>` com props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `onConfirm`, `loading`.
- O botao de confirmar deve ter `variant="destructive"` e mostrar loading state durante a acao.
- O trigger deve ser o botao de deletar/excluir ja existente.
- Manter o shadcn/ui Dialog pattern existente no projeto.

Exemplo de uso:
<ConfirmDialog
  open={deleteDialogOpen}
  onOpenChange={setDeleteDialogOpen}
  title="Excluir documento"
  description="Esta acao nao pode ser desfeita. O documento sera removido da base de conhecimento."
  confirmLabel="Excluir"
  onConfirm={handleDelete}
  loading={deleteDoc.isPending}
/>

Salvar o componente em: src/components/ui/confirm-dialog.tsx
```

---

### PROMPT A2 — Padronizar Loading States com Skeleton

```
Padronize os estados de loading em todas as paginas do projeto. Hoje algumas usam <Spinner>, outras usam <Skeleton>, outras nao tem skeleton.

Regra:
- Listas de cards/itens: usar <Skeleton> com o mesmo formato do card real (mesma altura, border-radius, espacamento)
- Tabelas: usar linhas de Skeleton com colunas simuladas
- KPI cards: usar Skeleton com h-28 ja feito no Dashboard (replicar para outras paginas)
- Acoes de mutation (botoes): manter Spinner dentro do botao + disable

Paginas que precisam de skeleton:
1. Automations.tsx — lista de automacoes (usar cards de skeleton)
2. Knowledge.tsx — lista de documentos (usar DocumentCard skeleton)
3. HumanAgents.tsx — cards de agentes humanos
4. Contacts.tsx — linhas da tabela de contatos
5. Queue.tsx — cards de tickets
6. Macros.tsx — grid de macros

Para cada, criar N cards/linhas de Skeleton (ex: 3-4 items) que espelham o layout real.
Reutilizar o componente <Skeleton> de @/components/ui/skeleton ja existente.
```

---

### PROMPT A3 — Padronizar Empty States com Ilustracao e CTA

```
Crie um componente reutilizavel <EmptyState> em src/components/ui/empty-state.tsx com as props:
- icon: LucideIcon (obrigatorio)
- title: string (obrigatorio)
- description: string
- action: { label: string; onClick: () => void; icon?: LucideIcon } (opcional)
- secondaryAction: { label: string; onClick: () => void } (opcional)

Estilo:
- Container: text-center py-16 space-y-4
- Icone: w-14 h-14 mx-auto text-muted-foreground opacity-30
- Title: text-lg font-semibold text-foreground
- Description: text-sm text-muted-foreground max-w-sm mx-auto
- Action: Button com icone a esquerda

Aplicar em:
1. Queue.tsx — "Nenhum ticket na fila" com icone ListOrdered e CTA "Atualizar"
2. Contacts.tsx — "Nenhum contato encontrado" com icone Users e CTA "Sincronizar contatos"
3. HumanAgents.tsx — "Nenhum agente humano" com CTA "Adicionar agente"
4. Tickets.tsx — "Nenhum ticket aberto" com icone Ticket
5. AI Consumption — "Sem dados de consumo" com descricao e CTA "Criar agente"
6. Automations.tsx — Empty state ja tem templates (manter o existente)
7. Knowledge.tsx — Empty state ja e bom (manter o existente)
```

---

### PROMPT A4 — Adicionar Breadcrumbs nas paginas de detalhe

```
Adicionar breadcrumb de navegacao nas seguintes paginas, usando o componente Breadcrumb do shadcn/ui:

1. ClientDetail.tsx (/clients/:id)
   Breadcrumb: Clientes > [Nome do Cliente]

2. AgentPlayground.tsx (/agents/playground/:id)
   Breadcrumb: Agentes > [Nome do Agente] > Playground

3. AutomationEditor.tsx (/automations/:id)
   Breadcrumb: Automacoes > [Nome da Automacao]

4. TicketDetail.tsx (/tickets/:id)
   Breadcrumb: Kanban > [Ticket ID]

5. KnowledgeBase.tsx (se tiver detalhe)
   Breadcrumb: Base de Conhecimento > [Titulo]

Posicionar o breadcrumb logo abaixo do Header/Sidebar, antes do conteudo principal da pagina.
Usar o componente Breadcrumb + BreadcrumbItem + BreadcrumbLink + BreadcrumbSeparator do shadcn/ui.
O ultimo item do breadcrumb deve ser BreadcrumbPage (nao clicavel).
```

---

### PROMPT A5 — Adicionar aria-label em todos os botoes de icone

```
Audite e adicione aria-label em TODOS os botoes que contem apenas icones (sem texto visivel) em todo o projeto React.

Padrao: todo <Button> ou <button> que contenha apenas um <Icon /> sem texto visivel deve ter:
- aria-label="Acao descritiva" (ex: aria-label="Excluir documento", aria-label="Editar agente", aria-label="Fechar dialog")
- Ou usar o componente <Tooltip> do shadcn/ui para exibir label ao hover.

Locais prioritarios:
- Inbox.tsx — botoes de acao na conversa (fechar, escalar, arquivar)
- Contacts.tsx — botoes de linha (editar, ignorar, detalhes)
- Knowledge.tsx — botoes de documento (editar, deletar, votar)
- AgentListCard.tsx — botoes de agente (editar, testar, deletar)
- AgentQATraining.tsx — botoes de editar e excluir Q&A

Para icones de acao critica (deletar, escalar), envolver em <Tooltip> com a acao descrita.
```

---

## BLOCO B — Dashboard

---

### PROMPT B1 — Adicionar Auto-refresh e Indicador de Dados em Tempo Real

```
No Dashboard.tsx, implemente:

1. Auto-refresh a cada 60 segundos (usar useEffect + setInterval).
   - Chamar queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] }) automaticamente.
   - Mostrar um indicador visual de "ultima atualizacao" no header: "Atualizado ha X segundos".

2. Transformar o botao "Atualizar" em um IconButton com icone RefreshCw que gira durante o refresh.
   - Adicionar estado `isRefreshing` que ativa durante a invalidacao.
   - Mostrar "Atualizando..." enquanto carrega, "Atualizado" apos.

3. Adicionar badge "AO VIVO" com dot animado (ping animation do Tailwind) ao lado do titulo Dashboard para indicar dados em tempo real.

4. Para cada KPI card, mostrar a seta de trend (cima ou baixo) colorida (verde/vermelho) comparando com ontem, se o dado estiver disponivel.

Reutilizar o useDashboardMetrics hook existente em src/hooks/useDashboardMetrics.ts.
```

---

### PROMPT B2 — Dashboard: Adicionar Secao de Alertas e Acoes Rapidas

```
No Dashboard.tsx, adicionar duas novas secoes:

1. **Alertas Prioritarios** (no topo, acima dos KPIs):
   - Mostrar cards de alerta vermelho/laranja quando:
     - Existem tickets ha mais de 30min sem atendimento (buscar de ai_conversations com handler_type='waiting')
     - CSAT abaixo de 3.5 nos ultimos 7 dias
     - Agente com success_rate < 60%
   - Cada alerta tem: icone AlertTriangle, descricao curta, botao "Ver" que navega para a area relevante
   - Se nao ha alertas, mostrar "Tudo ok! Sem alertas" com icone verde

2. **Acoes Rapidas** (sidebar ou row de cards clicaveis):
   - "Nova Automacao" -> /automations/new
   - "Adicionar Conhecimento" -> abre UploadDialog direto
   - "Criar Agente" -> /agents (abre dialog)
   - "Ver Fila" -> /queue

Usar o padrao Card + Button existente. Cada action card: icone grande centralizado, titulo, seta ->.
```

---

## BLOCO C — Inbox e Conversas

---

### PROMPT C1 — Inbox: Painel de Informacoes do Cliente Expandido

```
No componente de painel direito do Inbox (AI analysis panel / customer info), expanda as informacoes:

1. Mostrar dados do cliente Sismais (se vinculado via sismais-client-lookup):
   - Nome, modulo, plano, status de contrato
   - Historico de tickets anteriores (ultimos 5)
   - CSAT medio

2. Adicionar secao "Acoes do Agente Humano" (quando handler_type='human'):
   - Botao "Usar Macro" -> abre seletor de macros disponiveis
   - Botao "Adicionar Tag" -> input para adicionar tags ao ticket
   - Botao "Transferir" -> seletor de agente humano disponivel
   - Botao "Escalar Prioridade" -> muda prioridade do ticket

3. Adicionar secao "Sugestao do Copiloto":
   - Se existe agente copiloto ativo, exibir card com sugestao de resposta em tempo real
   - Botao "Usar sugestao" que copia o texto para o campo de digitacao

Reutilizar a chamada existente ao copilot-suggest edge function.
O painel direito existe em Inbox.tsx — expandir sem quebrar o layout atual.
```

---

### PROMPT C2 — Inbox: Indicadores de Status de Digitacao e Leitura

```
No Inbox.tsx, adicionar indicadores visuais de:

1. **Status de digitacao do cliente**: quando o cliente esta digitando no WhatsApp (se UAZAPI suportar o evento), mostrar "digitando..." com tres pontos animados abaixo da lista de mensagens.

2. **Confirmacao de leitura**: para mensagens enviadas pelo agente/IA, mostrar check (enviado) ou double-check (lido) ao lado da mensagem com base nos dados de receipt retornados pelo UAZAPI.

3. **Badge de "Nova mensagem"**: quando o usuario tem o painel de outro chat aberto e chega mensagem em outro, piscar o badge do contador no sidebar com pulse animation.

4. **Tempo de espera do cliente**: no topo do painel de conversa, mostrar ha quanto tempo o cliente esta esperando resposta (usar o campo updated_at da conversa).

Usar os dados disponiveis em uazapi_messages e ai_conversations.
```

---

## BLOCO D — Base de Conhecimento (Knowledge)

---

### PROMPT D1 — Knowledge: Filtros Avancados e Visualizacao em Cards vs Lista

```
Na pagina Knowledge.tsx, melhorar o sistema de filtros e visualizacao:

1. **Toggle de visualizacao** (Cards / Lista):
   - Cards: layout atual em grid
   - Lista: tabela compacta com title, categoria, data, contagem de uso, similarity score
   - Salvar preferencia em localStorage

2. **Filtros avancados**:
   - Filtro por data (criado nos ultimos 7/30/90 dias)
   - Filtro por agent_filter (mostrar docs de agente especifico)
   - Filtro por source (manual_upload, firecrawl, conversation_learning, agent_training)
   - Ordenacao: mais recente, mais usado (usage_count), mais votado (helpful_count)

3. **Contador de resultados**:
   - Mostrar "Exibindo X de Y documentos" no topo da lista
   - Mostrar em destaque quando filtros ativos reduzem a quantidade

4. **Bulk actions**:
   - Checkbox em cada card/linha
   - "Selecionar todos"
   - Acao: "Excluir selecionados", "Exportar selecionados"

Reutilizar o useKnowledgeBase hook existente em src/hooks/useKnowledgeBase.ts.
```

---

### PROMPT D2 — Knowledge: Preview e Edicao Inline de Documentos

```
Na pagina Knowledge.tsx e componente DocumentCard.tsx:

1. **Preview expandido**: ao clicar no titulo do documento, abrir um Sheet (painel lateral) com:
   - Conteudo completo do documento (renderizado como markdown usando react-markdown ou equivalente)
   - Metadata: fonte, URL original, data de criacao/atualizacao, category, tags
   - Metricas: vezes usado pelo RAG, votos positivos/negativos
   - Historico de versoes (mostrando updated_at)

2. **Edicao inline** no Sheet:
   - Botao "Editar" que transforma os campos em inputs editaveis
   - Campos: titulo, conteudo (textarea), categoria, tags
   - Ao salvar, chamar updateDocument do useKnowledgeBase e mostrar toast de sucesso

3. **Re-indexar embedding**:
   - Botao "Re-indexar" que chama generate-embedding novamente para o documento
   - Util quando o conteudo foi editado manualmente

4. **Teste de busca**:
   - Input no painel do documento para testar "se eu perguntar X, este documento aparece?"
   - Mostrar score de similarity da busca semantica

Reutilizar: updateDocument de useKnowledgeBase, generate-embedding edge function.
```

---

## BLOCO E — Fila e Tickets

---

### PROMPT E1 — Queue: Drag and Drop e Redistribuicao de Tickets

```
Na pagina Queue.tsx, adicionar:

1. **Redistribuicao manual de tickets**:
   - Botao "Atribuir" em cada card da fila -> abre dropdown com lista de agentes humanos disponiveis (is_online=true)
   - Apos atribuir, ticket sai da fila e aparece como "Em atendimento" com o nome do agente

2. **Filtros de fila**:
   - Filtro por priority (critica, alta, media, baixa) — ja existe parcialmente
   - Filtro por instancia WhatsApp (se houver multiplas)
   - Filtro por tag
   - Toggle "Mostrar apenas meus tickets" (filtrar por agente logado)

3. **Estatisticas em tempo real** no header da fila:
   - "X aguardando" | "Y em atendimento" | "Tempo medio de espera: Z min"
   - Atualizar automaticamente a cada 30s

4. **Prioridade visual**:
   - Cards criticos com borda esquerda vermelha pulsante
   - Cards com espera > 15min mudam para cor amarela de alerta
   - Cards com espera > 30min mudam para cor vermelha

Reutilizar: useQueueTickets hook, priorityConfig ja existente.
```

---

## BLOCO F — Agentes IA

---

### PROMPT F1 — AgentPlayground: Melhorar Experiencia de Teste

```
Na pagina AgentPlayground.tsx, melhorar a experiencia de testes:

1. **Historico de sessoes de teste**:
   - Salvar conversas de teste no localStorage com chave por agent_id
   - Botao "Historico" que lista sessoes anteriores com data/hora
   - Botao "Limpar historico"

2. **Comparacao A/B de modelos**:
   - Modo "Split" que divide a tela em dois paineis
   - Cada painel usa um modelo/configuracao diferente
   - Enviar a mesma mensagem para ambos simultaneamente
   - Mostrar: resposta, confidence, tokens usados, latencia — lado a lado

3. **Export de conversa de teste**:
   - Botao "Exportar" que gera JSON ou TXT com toda a conversa de teste
   - Util para documentacao e analise

4. **Configuracao rapida no playground**:
   - Slider para temperature (0-1) sem abrir o formulario completo
   - Toggle RAG on/off
   - Select de modelo
   - Todas as mudancas sao temporarias (nao persistem no banco)

Reutilizar: agent-executor edge function, supabase.functions.invoke pattern existente.
```

---

### PROMPT F2 — Agents: Metricas Detalhadas por Agente no Card

```
No componente AgentListCard.tsx, expandir as metricas exibidas:

1. **Metricas em tempo real** no card do agente:
   - Total de conversas hoje / esta semana
   - Taxa de resolucao (success_rate) com barra de progresso colorida (verde > 80%, amarelo 60-80%, vermelho < 60%)
   - Confianca media (avg_confidence)
   - Custo total esta semana (sum de cost_usd)
   - No de Q&As de treinamento (buscar de ai_knowledge_base onde agent_filter contem agent_id)

2. **Status do agente**:
   - Indicador visual: "Ativo" (verde) / "Em pausa" / "Sem conversas hoje" (cinza)
   - Last conversation timestamp: "Ultima conversa: ha 5 min"

3. **Acoes rapidas** no card (sem abrir dialog):
   - Toggle de ativo/inativo diretamente no card (Switch pequeno)
   - Botao "Ver conversas" -> navega para Inbox filtrado por agent_id

Reutilizar: useAgents hook, ai_agents table data.
```

---

## BLOCO G — Automacoes e Fluxos

---

### PROMPT G1 — Automations: Templates Expandidos e Galeria

```
Na pagina Automations.tsx, expandir o sistema de templates:

1. **Galeria de templates** com categorias:
   - Atendimento: "Saudacao automatica", "Encerramento de conversa", "Tempo de espera"
   - CRM: "Novo lead qualificado", "Follow-up apos resolucao", "Pesquisa CSAT"
   - Financeiro: "Lembrete de vencimento", "Confirmacao de pagamento"
   - Tecnico: "Ticket aberto", "Escalacao automatica", "SLA expirado"

2. **Preview do template** antes de usar:
   - Ao passar o mouse em um template, mostrar Popover com:
     - Descricao do que faz
     - Exemplo de trigger e acao
     - Casos de uso recomendados
   - Botao "Usar template" no Popover

3. **Duplicar automacao existente**:
   - Botao de "Duplicar" em cada automacao criada
   - Cria copia com sufixo " (copia)" no nome
   - Navega para edicao da copia

4. **Historico de execucoes**:
   - Em cada automacao, aba "Execucoes" mostrando as ultimas 20 execucoes
   - Cada linha: data/hora, trigger, resultado (sucesso/falha), duracao

Reutilizar: useAutomations hook, supabase queries de ai_automations.
```

---

## BLOCO H — Configuracoes e Admin

---

### PROMPT H1 — Settings: Reorganizar com Grupos Visuais Melhores

```
Na pagina Settings.tsx, reorganizar a interface:

1. **Sidebar de navegacao vertical** ao inves de TabsList horizontal:
   - Grupos visuais com icones:
     Empresa (categorias, modulos)
     Kanban (boards, estagios, SLA)
     Integracoes (webhooks, APIs)
     IA (configuracoes globais ja em AISettings)
     Usuarios (link para /admin/users)
     Sistema (logs, auditoria)

2. **Cada secao com header descritivo**:
   - Titulo da secao
   - Descricao curta do que pode ser configurado
   - Link "Saiba mais" se relevante

3. **Salvamento automatico**:
   - Ao alterar um toggle/select/input, autosave com debounce de 1s
   - Mostrar "Salvo automaticamente" ao lado do campo

4. **Secao "Perigos"** (danger zone):
   - Area destacada em vermelho no final
   - Acoes de reset (limpar base de conhecimento, etc.)
   - Requer confirmacao via AlertDialog

Manter os dados existentes das tabelas (kanban_boards, ticket_categories, etc.).
```

---

## BLOCO I — WhatsApp e Instancias

---

### PROMPT I1 — WhatsAppInstances: Dashboard de Saude das Instancias

```
Na pagina WhatsAppInstances.tsx, transformar de lista simples em dashboard de saude:

1. **Card de status por instancia**:
   - Badge colorido: Conectada (verde) / Desconectada (vermelho) / Aguardando QR (amarelo)
   - Numero de mensagens enviadas/recebidas hoje
   - Ultima atividade (timestamp)
   - Webhook status (configurado? testado?)

2. **Acoes rapidas por instancia**:
   - "Reconectar" -> chama whatsapp-test-connection
   - "Ver QR Code" -> exibe QR code para reconexao
   - "Ver logs" -> mostra ultimas 20 mensagens da instancia

3. **Teste de envio**:
   - Input de numero + mensagem de teste
   - Botao "Enviar teste" -> chama whatsapp-send edge function
   - Exibe resultado do envio (sucesso/erro)

4. **Status global**:
   - Card no topo com: X instancias conectadas de Y total, taxa de uptime

Reutilizar: whatsapp-test-connection, uazapi-proxy edge functions.
```

---

## BLOCO J — UI Global e Performance

---

### PROMPT J1 — Implementar Command Palette (Ctrl+K)

```
Implementar uma Command Palette acessivel via Ctrl+K (ou Cmd+K no Mac) usando o componente Command do shadcn/ui.

Funcionalidades da paleta:
1. **Navegacao rapida**: digitar nome da pagina -> navegar direto
   - "inbox", "queue", "agentes", "conhecimento", "dashboard"

2. **Acoes rapidas**:
   - "Novo agente" -> abre AgentFormDialog
   - "Adicionar conhecimento" -> abre UploadDialog
   - "Nova automacao" -> navega para /automations
   - "Ver fila" -> navega para /queue

3. **Busca de conversas**:
   - Digitar numero ou nome -> buscar em ai_conversations
   - Mostrar resultados com avatar, nome, ultimo preview de mensagem

4. **Busca na base de conhecimento**:
   - Prefixo "?" -> busca semantica no knowledge
   - Mostrar top 5 resultados mais relevantes

Implementacao:
- Componente global em MainLayout.tsx
- useEffect para keydown listener (Ctrl/Cmd + K)
- State com Dialog wrapping o Command component
- Salvar em src/components/layout/CommandPalette.tsx

Usar componentes existentes: Command, CommandInput, CommandList, CommandItem, CommandGroup do shadcn/ui.
```

---

### PROMPT J2 — Implementar Modo Compacto / Densidade de Interface

```
Adicionar uma configuracao de "Densidade de Interface" no Settings ou no Header:

1. **3 modos de densidade**:
   - Compacto: padding reduzido, fontes menores, cards mais estreitos
   - Padrao: atual
   - Confortavel: mais espaco, fontes ligeiramente maiores

2. **Implementacao via CSS custom property** no root:
   - `--density: compact | default | comfortable`
   - Ajustar padding dos cards, tamanho de fonte, gap entre elementos

3. **Salvar preferencia** no localStorage e no perfil do usuario

4. **Toggle no Header**: icone de LayoutList/LayoutGrid para alternar rapido entre compacto e padrao

Aplicar densidade especialmente em:
- Tabela de Contacts (compacto = muito mais linhas visiveis)
- Lista de conversas no Inbox
- Cards de tickets no Kanban
- Grid de agentes

Criar um hook `useDensity()` que retorna o nivel atual e a funcao para alterar.
```

---

### PROMPT J3 — Notificacoes Push e Badge no Titulo da Aba

```
Implementar notificacoes em tempo real usando Supabase Realtime:

1. **Badge de notificacoes no Header**:
   - Icone Bell com badge numerico vermelho
   - Conta: novas mensagens + tickets criticos + CSAT baixo
   - Dropdown com lista de notificacoes recentes (ultimas 10)
   - "Marcar todas como lidas"

2. **Subscriptions Realtime**:
   - Ouvir INSERT em uazapi_messages (nova mensagem recebida)
   - Ouvir UPDATE em ai_conversations (nova escalacao para humano)
   - Ouvir INSERT em ai_learning_feedback (novo feedback negativo)

3. **Badge no titulo da aba do browser**:
   - Quando ha mensagem nao lida: "(3) Sismais Helpdesk"
   - Quando nao ha: "Sismais Helpdesk"

4. **Notificacoes do browser** (Notification API):
   - Pedir permissao ao usuario na primeira visita
   - Se concedido, disparar notificacao nativa quando chegar mensagem nova
   - Clicar na notificacao abre o chat correspondente no Inbox

Implementar em: src/hooks/useRealtimeNotifications.ts
Usar: supabase.channel().on() pattern do Supabase Realtime.
```

---

# PARTE 2 — 5 IDEIAS DE MAIOR AUTONOMIA IA PARA O SISCRM

---

## IDEIA 1 — Agente de Saude do Cliente (Customer Health Score Proativo)

**O que e:**
Um agente IA que monitora continuamente a "saude" de cada cliente do Sismais, calculando um score baseado em: frequencia de tickets, tempo medio de resolucao, CSAT historico, uso do produto, inadimplencia, e comportamento no WhatsApp. Quando o score cai abaixo de um threshold, o agente age proativamente.

**Como funciona:**
- A edge function `calculate-health-scores` ja existe — e subutilizada.
- O agente processa scores diariamente e identifica clientes em risco.
- Envia automaticamente mensagem personalizada via WhatsApp: "Ola [nome], notamos que voce teve [X tickets] esta semana. Tem algo que possamos melhorar?"
- Escala para a equipe de sucesso do cliente com contexto completo quando score < 40.
- Gera relatorio semanal de churn risk para o gestor (via generate-report).

**Impacto na experiencia do cliente:**
- Proatividade — cliente sente que a empresa se importa antes de reclamar.
- Reducao de churn silencioso (clientes que saem sem avisar).
- Personalizacao genuina baseada no historico real do cliente.

---

## IDEIA 2 — Aprendizado Continuo por Feedback de Comportamento (Behavioral Learning Loop)

**O que e:**
O sistema IA aprende continuamente a partir do comportamento real dos atendentes humanos — quando um humano edita a resposta da IA antes de enviar, essa edicao vira conhecimento estruturado automaticamente.

**Como funciona:**
- Instrumentar o Inbox: quando agente humano edita resposta sugerida pelo copiloto antes de enviar, capturar o par [pergunta original -> resposta humana editada].
- Comparar a resposta da IA com a resposta humana editada via LLM.
- Se as respostas divergem significativamente (similarity < 0.7), extrair o aprendizado e salvar como Q&A de alta confianca na base de conhecimento.
- O sistema gera automaticamente: "Aprendi X novo comportamento de atendimento com [Agente Y]."
- Dashboard de "Conhecimento aprendido esta semana" para o gestor.

**Impacto na experiencia do cliente:**
- IA melhora a cada interacao humana sem treinamento manual.
- Respostas ficam cada vez mais alinhadas com a cultura e voz da empresa.
- Menos escalacoes para humanos com o tempo.

---

## IDEIA 3 — Orquestracao Temporal: Agente de Seguimento Automatico (Follow-up)

**O que e:**
Um agente IA que gerencia o follow-up de todas as conversas encerradas ou pausadas, enviando mensagens automaticas no momento certo para verificar satisfacao, reengajar clientes inativos, ou lembrar de renovacoes.

**Como funciona:**
- Ao encerrar um ticket, o sistema agenda automaticamente:
  - D+1: "Seu problema foi resolvido? Ficou alguma duvida?"
  - D+3 (se nao respondeu): "Esperamos que tudo esteja funcionando bem!"
  - D+30 (para contratos): "Como esta seu uso do Sismais? Podemos ajudar com algo?"
- O agente de follow-up analisa o contexto da conversa original para personalizar cada mensagem.
- Se cliente responder com problema, cria novo ticket linkado ao original.
- Integracao com vencimentos de contrato (helpdesk_client_contracts) para follow-ups de renovacao.

**Impacto na experiencia do cliente:**
- Nenhum cliente fica esquecido apos resolucao.
- CSAT melhora porque o cliente sente cuidado pos-atendimento.
- Oportunidades de upsell identificadas naturalmente no follow-up.

---

## IDEIA 4 — Triagem Preditiva por Intencao e Sentimento em Tempo Real

**O que e:**
Elevar o agente de triagem para nao apenas categorizar, mas predizer o nivel de urgencia real e o estado emocional do cliente em tempo real, adaptando toda a cadeia de atendimento com base nisso.

**Como funciona:**
- Ao receber primeira mensagem, o message-analyzer roda analise multimodal: texto + historico do cliente + hora do dia + dia da semana + padrao de reclamacoes do setor.
- Gera um "Perfil de Atendimento" do cliente nessa conversa:
  - Sentimento: irritado / neutro / satisfeito
  - Intencao real: suporte tecnico / reclamacao / cancelamento / renovacao
  - Urgencia real (nao declarada): baixa / media / alta / critica
  - Perfil do cliente: novo / recorrente / VIP / inadimplente
- Orquestrador usa esse perfil para priorizar a fila, escolher agente com melhor fit, e ajustar o tom do system_prompt do agente em tempo real.
- Se intencao = cancelamento, roteamento automatico para agente de retencao com script especifico.

**Impacto na experiencia do cliente:**
- Nunca mais cliente irritado atendido com tom casual.
- Cliente VIP sempre atendido com prioridade maxima automaticamente.
- Intencao de cancelamento identificada antes de ser expressa — retencao proativa.

---

## IDEIA 5 — Base de Conhecimento Auto-evolutiva com Curadoria IA

**O que e:**
A base de conhecimento deixa de ser estatica e passa a ser um organismo vivo: a IA identifica lacunas, sugere novos conteudos, detecta informacoes desatualizadas, e mantem tudo consistente automaticamente.

**Como funciona:**
- **Detector de lacunas**: quando o agente de suporte recorre a escalacao humana por falta de informacao, o sistema registra a pergunta sem resposta. Semanalmente, gera uma lista "Perguntas sem resposta na base" para o gestor preencher.
- **Detector de desatualizacao**: periodicamente, o sistema pega documentos com updated_at > 90 dias e usa LLM para verificar se ainda fazem sentido com base nos tickets recentes. Sugere atualizacao.
- **Consolidacao de duplicatas**: identifica documentos com similarity > 0.88 e propoe merge automatico, mantendo o mais recente.
- **Score de relevancia**: documentos com helpful_count baixo e usage_count alto mas csat baixo sao candidatos a revisao — alerta automatico.
- **Geracao automatica de FAQ**: a cada 7 dias, analisa as 20 perguntas mais frequentes da semana e gera rascunhos de Q&As para aprovacao do gestor antes de publicar.

**Impacto na experiencia do cliente:**
- Respostas sempre atualizadas, nunca desatualizadas.
- Menos escalacoes porque a base cresce automaticamente.
- FAQ gerado automaticamente reduz tickets repetitivos.

---

# PARTE 3 — UX/UI: PONTOS DE MELHORIA PRIORIZADOS

## Critico (maior impacto)

1. **Substituir confirm() por AlertDialog** — em Knowledge, Agents, Automations, Contacts
2. **Loading skeletons** — Automations, Contacts, HumanAgents, Queue usam apenas Spinner
3. **Empty states** — Queue, Contacts, Tickets, AI Consumption sem estado vazio rico
4. **Notificacoes em tempo real** — sem Supabase Realtime nas conversas
5. **Formularios sem validacao em tempo real** — campos obrigatorios so avisam no submit

## Importante (melhoria significativa)

6. **Breadcrumbs** ausentes em ClientDetail, AgentPlayground, AutomationEditor
7. **Aria-labels** em todos os botoes de icone (acessibilidade)
8. **Mobile responsiveness** — ClientDetail 2-pane, Contacts table, AIConsumptionDashboard
9. **Command Palette (Ctrl+K)** — navegacao rapida muito valorizada em ferramentas de produtividade
10. **Auto-refresh no Dashboard** — dados ficam desatualizados sem refresh manual

## Melhoria de Qualidade

11. **Density control** — modo compacto para usuarios com muitos dados
12. **Breadcrumb na KanbanPage** — mostrar qual board esta sendo visualizado
13. **Botao "Reconectar"** no WhatsApp Instances para instancias desconectadas
14. **Export de dados** — botao exportar CSV/JSON nas principais listas
15. **Copiar ID/telefone** — clipboard em campos de dados do cliente
16. **Metricas detalhadas** nos cards de agente IA (success_rate visual)
17. **Preview de macro antes de usar** no Inbox
18. **Historico de edicoes** nos documentos da base de conhecimento
19. **Tema de cor personalizavel** por empresa (beyond dark/light)
20. **Onboarding flow** para novos usuarios (primeiro acesso guiado)
