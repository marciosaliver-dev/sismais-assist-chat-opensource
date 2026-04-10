# E12 — Auditoria UX/UI Completa: GMS Helpdesk IA

**Data:** 2026-03-19
**Autor:** Especialista UX/UI — Sismais Tecnologia
**Produto:** GMS — Gestao Mais Simples (Helpdesk IA)
**Escopo:** Auditoria de 55+ paginas React, conformidade com design system GMS, propostas de melhoria

---

## Sumario Executivo

O GMS Helpdesk IA possui uma interface funcional e abrangente com 55+ telas cobrindo todo o fluxo de helpdesk + IA. A base tecnica (shadcn/ui + Tailwind + React Query) e solida. Porem, a identidade visual GMS nao e aplicada de forma consistente — a maioria das telas usa tokens genericos do Tailwind (`text-foreground`, `bg-primary`) em vez da paleta GMS explicita (#10293F, #45E5E5, #FFB800). Apenas o Dashboard e Evaluations aplicam a paleta GMS diretamente. Ha oportunidades significativas de melhoria em hierarquia visual, densidade de informacao, responsividade mobile e acessibilidade.

**Nota Geral do Produto: 6.5/10** — Funcional e completo, mas precisa de polish profissional.

---

## 1. Auditoria Tela por Tela

### 1.1 Prioridade Alta

#### Dashboard (`/`) — Nota: 8/10
**Pontos positivos:**
- Saudacao contextual com nome do usuario e data em portugues
- Badge "AO VIVO" com animacao ping — excelente feedback
- Auto-refresh com contador de tempo desde ultima atualizacao
- KPIs bem estruturados com acentos de cor
- Tabs com borda inferior cyan (#45E5E5) no ativo — conforme GMS
- Paleta GMS aplicada diretamente (`text-[#10293F]`, `bg-[#10293F]`, `text-[#45E5E5]`)

**Problemas:**
- P1: Loading skeleton mostra 4 cards mas KPIs sao 5 — inconsistencia
- P2: Secao "Agentes Ativos" sem gap entre titulo e grid (falta `mt-3` ou similar)
- P3: Nao ha breadcrumb (topbar GMS ausente — usa layout do MainLayout)
- P4: Mobile: KPIs em 1 coluna, mas graficos nao sao otimizados para 320px

**Sugestoes:**
- Adicionar mini-sparklines nos KPI cards para tendencia
- Colocar filtro de data no header (hoje/semana/mes)

---

#### KanbanPage (`/kanban/:slug`) — Nota: 7/10
**Pontos positivos:**
- Delegacao limpa para componente `KanbanBoard` — boa separacao
- Redirect automatico para board padrao se slug invalido
- Loading e empty state presentes

**Problemas:**
- P1: Pagina e apenas um wrapper — toda a UX depende do componente `KanbanBoard` (nao auditado aqui)
- P2: Nao ha breadcrumb ou indicador de qual board esta ativo no nivel da pagina
- P3: Empty state generico "Nenhum board Kanban encontrado" — deveria orientar o usuario a criar um

**Sugestoes:**
- Adicionar header com nome/icone do board e seletor de boards (tabs ou dropdown)
- Incluir CTA para criar board no empty state

---

#### Queue (`/queue`) — Nota: 7.5/10
**Pontos positivos:**
- Timer em tempo real com cores condicionais (verde/amarelo/vermelho)
- Filtros multiplos (prioridade, produto, categoria) + toggle "Minha fila"
- Badge com contagem de tickets filtrados
- Agentes online no canto superior direito
- Skeleton loading fiel ao layout real

**Problemas:**
- P1: Cores de prioridade usam Tailwind generico (`bg-red-500/15`) em vez da paleta GMS
- P2: Botao "Assumir" sem confirmacao — acao irreversivel com 1 clique
- P3: Nao ha indicacao de SLA ou urgencia temporal alem do timer
- P4: Nao ha paginacao — lista pode ficar lenta com 100+ tickets
- P5: Header fixo com filtros ocupa muito espaco vertical em mobile

**Sugestoes:**
- Adicionar indicador de SLA (barra de progresso ou icone de alerta)
- Confirmar "Assumir" com dialog rapido
- Virtualizar a lista para performance
- Cores de prioridade: usar `#DC2626` (critica), `#FFB800` (media), `#16A34A` (baixa) da paleta GMS

---

#### Agents (`/agents`) — Nota: 8/10
**Pontos positivos:**
- Tabs por funcao/papel com contagem — excelente organizacao
- Pipeline visual do orquestrador (`AgentFlowPipeline`)
- Descricao contextual por tab ativa
- Fluxo de criacao via IA (SkillAgentDialog) — inovador
- Confirmacao de exclusao com ConfirmDialog

**Problemas:**
- P1: Tabs com `border-primary` generico em vez de `border-b-[#45E5E5]` da paleta GMS
- P2: 9 tabs horizontais podem estourar em telas <1024px
- P3: Grid de agentes 1-2 colunas — poderia ser 3 em telas largas

**Sugestoes:**
- Usar `#45E5E5` como cor de borda ativa nas tabs (conforme design system)
- Adicionar scroll horizontal com indicador de overflow nas tabs
- Grid 1/2/3 colunas responsivo

---

#### AgentPlayground (`/agents/playground/:id`) — Nota: 7.5/10
**Pontos positivos:**
- Tema dark slate coerente com contexto "terminal/dev"
- Breadcrumb com hierarquia correta (Agentes > Nome > Playground)
- Badge "Simulacao" em destaque
- Barra de metricas em tempo real
- Exportar e Reiniciar no header

**Problemas:**
- P1: Tema dark (`bg-slate-950`) diverge completamente do design system GMS
- P2: Botao voltar usa `variant="ghost"` — pouco visivel em fundo escuro
- P3: Nao ha indicacao de qual persona esta ativa no header

**Sugestoes:**
- Usar `#10293F` como fundo escuro (navy GMS) em vez de slate-950
- Mostrar persona ativa como badge no header
- Sombras com tom navy conforme GMS

---

#### ClientDetail (`/clients/:id`) — Nota: 7/10
**Pontos positivos:**
- Layout split (sidebar 280px + content area) — padrao profissional
- Avatar com iniciais + produto em gradient
- Metricas compactas (4 mini-cards 2x2)
- Tabs para historico + anotacoes
- CRUD completo: contatos, contratos, anotacoes

**Problemas:**
- P1: Emoji em badges (💻, ⚠) — nao segue icones Material/Lucide do GMS
- P2: Sidebar fixa 280px nao colapsa em mobile — tela quebra
- P3: Coluna direita com historico nao tem busca/filtro
- P4: Dialogs usam `max-w-lg` mas formularios sao densos — scroll excessivo
- P5: Botao "Editar Cliente" no topo, mas contatos/contratos tem "Adicionar" inline — inconsistencia

**Sugestoes:**
- Mobile: empilhar sidebar acima do content (flex-col)
- Adicionar busca/filtro no historico de conversas
- Substituir emojis por icones Lucide

---

#### Customer360 (`/customer360/:id`) — Nota: 7/10
**Pontos positivos:**
- KPIs em grid 6 colunas — panorama completo (health, NPS, CSAT, conversas, contratos, MRR)
- Alertas contextuais (renovacao, risco de churn) com destaque visual
- Conversas recentes com click para abrir ticket

**Problemas:**
- P1: Pagina duplica parcialmente o ClientDetail — fluxo confuso (qual usar?)
- P2: KPI cards sem hover/focus — parecem estaticos
- P3: Health score sem explicacao visual (o que cada nivel significa)
- P4: Coluna esquerda (atividade) e estreita — informacoes comprimidas em mobile
- P5: Anotacoes so aparecem se existirem — nao ha CTA para criar

**Sugestoes:**
- Unificar Customer360 e ClientDetail em uma unica tela com abas
- Adicionar tooltip explicando cada nivel de health score
- Metric cards com hover conforme padrao GMS (translateY -1px + box-shadow)

---

#### Knowledge (`/knowledge`) — Nota: 7.5/10
**Pontos positivos:**
- Sidebar de produtos/grupos — navegacao hierarquica
- Busca semantica com toggle e feedback visual
- Filtros por visibilidade (publico/IA/ambos) como pills
- Importacao do Zoho Desk
- Grid de documentos com similarity badge na busca semantica

**Problemas:**
- P1: Header com `h-screen` causa problemas de scroll dentro de MainLayout
- P2: Dois niveis de header (page header + content header) — redundante
- P3: Muitos filtros simultaneos (visibilidade + busca + categoria + tipo + produto + grupo)
- P4: Nao ha preview inline — precisa abrir dialog para ver conteudo
- P5: Botao "Importar" sem indicacao de fonte (Zoho Desk) — label vaga

**Sugestoes:**
- Unificar headers em uma unica barra
- Preview inline expandivel ao clicar no card
- Renomear "Importar" para "Importar do Zoho Desk"

---

### 1.2 Prioridade Media

#### Automations (`/automations`) — Nota: 7/10
**Pontos positivos:**
- Stats row com total/ativas/execucoes
- Templates colapsaveis com categorias coloridas
- 4 tabs (todas/ativas/inativas/fluxos visuais)
- Filtros com busca e trigger type

**Problemas:**
- P1: Templates colapsados por padrao — a maioria dos usuarios nunca vera
- P2: Tab "Fluxos Visuais" mistura conceitos (automacoes vs flows)
- P3: Stats cards sem icone de secao ou titulo de contexto
- P4: Empty state repete CTA em cada tab — poderia ser centralizado

**Sugestoes:**
- Templates visíveis por padrao para novos usuarios (0 automacoes)
- Separar Flow Builder da pagina de Automacoes
- Stats cards com titulo da secao e hover

---

#### FlowBuilder (`/flow-builder`) — Nota: 5/10
**Problemas:**
- P1: Pagina e apenas wrapper para componentes — sem header, sem breadcrumb
- P2: Sem indicacao visual do que e um "fluxo visual"
- P3: Canvas provavelmente nao funciona bem em mobile

**Sugestoes:**
- Adicionar header com titulo e breadcrumb
- Adicionar tutorial/onboarding para primeiro uso

---

#### Macros (`/macros`) — Nota: 7.5/10
**Pontos positivos:**
- Grid de cards com cor customizavel por macro
- Preview da mensagem no card
- Toggle ativo/inativo inline
- Acoes hover-reveal (editar/excluir)

**Problemas:**
- P1: Cores das macros sao arbitrarias (indigo, roxo, rosa...) — nao seguem paleta GMS
- P2: Tamanho do card varia com conteudo — grid desalinhado
- P3: Nao ha ordenacao ou drag-and-drop (campo `sort_order` existe mas nao e usado)
- P4: Variavel `{nome}` e unica — sem lista de variaveis disponiveis

**Sugestoes:**
- Limitar cores a paleta GMS
- Altura fixa nos cards com overflow
- Implementar drag-and-drop para reordenacao

---

#### WhatsAppInstances (`/whatsapp-instances`) — Nota: 6.5/10
**Pontos positivos:**
- Cards por instancia com barra verde no topo (conectado)
- Status badge (conectado/aguardando QR/desconectado)
- Modo teste com toggle e numero de teste

**Problemas:**
- P1: Cards muito altos (muitas acoes) — scrolla para ver tudo
- P2: Secao "Modo Teste IA" dentro de cada card — deveria ser tab ou secao separada
- P3: Botao "Limpar Historico" em laranja sem contexto suficiente
- P4: QR Code display muito pequeno (w-40 h-40)
- P5: Cards em grid 3 colunas mesmo com 1 instancia — muito espaco vazio

**Sugestoes:**
- Reorganizar acoes em menu dropdown (3 dots)
- Ampliar QR Code em modal ao clicar
- Layout adaptavel: 1 instancia = card unico full-width

---

#### AISettings (`/ai-settings`) — Nota: 7/10
**Pontos positivos:**
- 4 tabs organizadas (catalogo, creditos, IAs internas, squads)
- Tabela de modelos com sort, filtro, paginacao
- Wizard de configuracao como CTA destacado em cyan GMS
- Dialog de detalhe por modelo

**Problemas:**
- P1: Filtros usam `<select>` nativo HTML em vez de shadcn Select — inconsistencia
- P2: Tabela muito densa em mobile — overflow horizontal sem indicador
- P3: Credits tab com muitos cards pequenos — hierarquia confusa

**Sugestoes:**
- Substituir `<select>` por shadcn `Select`
- Adicionar responsive table ou card view em mobile
- Consolidar credits em layout mais limpo

---

#### AIConsumptionDashboard (`/ai-consumption`) — Nota: 7.5/10
**Pontos positivos:**
- 7 sub-tabs cobrindo todos os angulos (visao geral, mensagens, features, agentes, modelos, performance, top conversas)
- KPIs com tendencias vs periodo anterior
- Exportar CSV
- Graficos Recharts bem configurados

**Problemas:**
- P1: Tabs como botoes rounded em vez de tabs com borda inferior — diverge do padrao GMS
- P2: `ScrollArea` no nivel da pagina pode conflitar com layout do MainLayout
- P3: 7 tabs e excessivo — considerar agrupar
- P4: Graficos sem interatividade (zoom, drill-down)

**Sugestoes:**
- Reduzir para 4-5 tabs (agrupar agentes+modelos, performance+top)
- Tabs com estilo GMS (borda inferior cyan)

---

### 1.3 Prioridade Baixa

#### Clients (`/clients`) — Nota: 6/10
**Problemas:**
- P1: Pagina delega tudo para `SismaisAdminClientsTab` — sem controle de UX
- P2: Apenas header + componente — sem stats, filtros ou metricas

**Sugestoes:**
- Adicionar stats cards (total clientes, ativos, em risco)
- Adicionar busca e filtros na pagina

---

#### HumanAgents (`/human-agents`) — Nota: 7/10
**Pontos positivos:**
- Cards com indicador online (barra verde topo + dot verde no avatar)
- Carga de trabalho com barra de progresso
- Stats row (total, online, conversas, CSAT)
- Toggles ativo/online inline

**Problemas:**
- P1: Dialogs de criar/editar sao identicos mas separados — poderia ser unico
- P2: Cards nao mostram tempo online ou ultima atividade

**Sugestoes:**
- Adicionar "online ha Xmin" no card
- Unificar dialog criar/editar

---

#### Supervisor (`/supervisor`) — Nota: 7/10
**Pontos positivos:**
- Layout limpo com 3 secoes claras (KPIs, fila de revisao, oportunidades de treino)
- Indicadores visuais (dots coloridos) para cada secao

**Problemas:**
- P1: Nao segue `page-container/page-content` pattern das outras telas
- P2: Header sem breadcrumb
- P3: Delegacao total para sub-componentes — sem indicadores de estado na pagina

---

#### Evaluations (`/evaluations`) — Nota: 8/10
**Pontos positivos:**
- Paleta GMS aplicada diretamente (`text-[#10293F]`, `bg-[#10293F]`, `text-[#45E5E5]`)
- Grafico de distribuicao de notas com cores semanticas (verde/amarelo/vermelho)
- Filtros com chips removiveis — excelente UX
- Exportar CSV e PDF
- Painel lateral slide-over para detalhes do ticket
- KPIs com accents GMS

**Problemas:**
- P1: Painel lateral esconde conteudo principal em mobile (`hidden lg:block`)
- P2: Nao usa `page-container` pattern

---

#### Campaigns (`/campaigns`) — Nota: 7/10
**Pontos positivos:**
- Stats row, pendentes de aprovacao, tabs + filtros
- CRUD completo com duplicar e executar agora

**Problemas:**
- P1: Similar a Automations em layout — usuario pode confundir
- P2: Sem preview de mensagem no card

---

#### Settings (`/settings`) — Nota: 6/10
**Problemas:**
- P1: 9 tabs horizontais — overflow critico em telas < 1200px
- P2: Tabs com `flex-wrap h-auto` — quebra em linhas multiplas, confuso
- P3: Nenhuma indicacao de qual secao esta editando atualmente

**Sugestoes:**
- Sidebar de navegacao (vertical) em vez de tabs horizontais
- Ou agrupar em categorias (Operacao, SLA, Integracoes)

---

#### Login (`/login`) — Nota: 6.5/10
**Pontos positivos:**
- Logo Sismais presente
- Card centralizado limpo

**Problemas:**
- P1: Nao usa paleta GMS para o CTA (botao usa `bg-primary` generico)
- P2: Sem indicacao de "esqueci minha senha"
- P3: Background `bg-background` generico — poderia ser navy GMS ou gradient
- P4: Labels em `<label>` manual em vez de shadcn `Label`

**Sugestoes:**
- Background navy gradient ou imagem GMS
- Botao de login em cyan (#45E5E5) com texto navy (#10293F)
- Adicionar "Esqueci minha senha"

---

#### ServiceCatalog (`/service-catalog`) — Nota: 7/10
**Pontos positivos:**
- Accordion explicativo sobre escopo do suporte — excelente para onboarding
- Cards com preco destacado e tempo estimado
- Filtro por categoria

**Problemas:**
- P1: Categorias hardcoded no frontend
- P2: Accordion com muito texto — pode intimidar

---

#### Feriados (`/feriados`) — Nota: 6.5/10
- CRUD basico funcional
- Sem calendar view (seria ideal para feriados)

#### Reports (ExecutiveDashboard, TicketReport, CompanyVolumeReport) — Nota: 7/10
- Graficos Recharts bem implementados
- Falta filtro de data consistente entre relatorios

#### Help pages (HelpCenter, HelpContent, HelpVideos, etc.) — Nota: 6/10
- Funcional mas sem identidade GMS
- Muitas sub-paginas que poderiam ser tabs de uma unica tela

#### Admin pages (AdminUsers, AdminPermissions, AdminIntegrations) — Nota: 6.5/10
- Funcionais mas layout basico
- AdminUsers muito similar a HumanAgents — confuso para o usuario

---

## 2. Top 10 Problemas de UX Mais Criticos

| # | Problema | Impacto | Telas Afetadas |
|---|---------|---------|----------------|
| 1 | **Paleta GMS nao aplicada consistentemente** — maioria usa tokens genericos Tailwind em vez de #10293F/#45E5E5/#FFB800 | Identidade visual diluida | 80% das telas |
| 2 | **Responsividade mobile inexistente ou quebrada** — sidebars fixas, grids rigidos, tabelas sem overflow | Inacessivel em celulares | ClientDetail, Knowledge, Settings, AISettings |
| 3 | **Excesso de tabs horizontais** — Settings (9), AIConsumption (7), Agents (9) estouram em telas medias | Navegacao confusa, overflow oculto | Settings, AIConsumption, Agents |
| 4 | **Duplicidade de telas** — ClientDetail vs Customer360, HumanAgents vs AdminUsers | Usuario nao sabe qual usar | Clientes, Agentes humanos |
| 5 | **Sombras com preto puro** — `shadow-md`, `shadow-lg` Tailwind usam rgba(0,0,0,X) em vez de rgba(16,41,63,X) GMS | Sombras nao harmonizam com paleta navy | Todas as telas |
| 6 | **Tabs ativas sem cyan GMS** — maioria usa `border-primary` ou `bg-primary` generico | Inconsistencia com design system | 70% das telas com tabs |
| 7 | **Acoes destrutivas sem confirmacao** — "Assumir" ticket na Queue e 1-click | Erros irreversiveis | Queue |
| 8 | **Loading states inconsistentes** — alguns usam Skeleton, outros Spinner, outros Loader2 | Experiencia fragmentada | Todas |
| 9 | **Sem breadcrumb padrao** — apenas 3-4 telas implementam breadcrumb | Usuario perde contexto de navegacao | Maioria das telas |
| 10 | **Emojis em vez de icones** — 💻, ⚠, 🤖, ⭐ usados em badges em vez de Lucide/Material | Inconsistencia visual, acessibilidade | ClientDetail, Evaluations |

---

## 3. Wireframes/Mockups Propostos

### 3.1 Layout Master Proposto

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR GMS (navy #10293F, 52px, sticky)                            │
│  [GMS Logo] [Breadcrumb] [Notifications] [User Avatar]              │
├────────┬────────────────────────────────────────────────────────────┤
│ SIDEBAR│  PAGE CONTENT                                              │
│ 60px   │  ┌──────────────────────────────────────────────────────┐  │
│ icons  │  │ PAGE HEADER (titulo + subtitulo + acoes)              │  │
│ navy   │  ├──────────────────────────────────────────────────────┤  │
│        │  │ KPI CARDS (grid 2-5 cols)                            │  │
│        │  ├──────────────────────────────────────────────────────┤  │
│        │  │ TABS (borda inferior cyan #45E5E5 no ativo)          │  │
│        │  ├──────────────────────────────────────────────────────┤  │
│        │  │ CONTENT AREA (cards, tabelas, etc.)                  │  │
│        │  └──────────────────────────────────────────────────────┘  │
└────────┴────────────────────────────────────────────────────────────┘
```

### 3.2 Inbox Unificada (Proposta Nova — referencia Gmail/Slack)

```
┌────────────────┬──────────────────────┬────────────────────────────┐
│ CONVERSATION    │ CHAT                  │ CONTEXT PANEL              │
│ LIST (320px)    │ (flex-1)              │ (360px, collapsible)       │
│                 │                       │                            │
│ [Search]        │ [Header: nome+status] │ [Cliente: avatar+info]     │
│ [Filters]       │                       │ [Health Score]             │
│                 │ [Messages...]         │ [Tags]                     │
│ [Conversation1] │                       │ [Historico resumido]       │
│ [Conversation2] │ [AI Confidence Bar]   │ [Contrato]                 │
│ [Conversation3] │                       │ [Anotacoes]                │
│ ...             │ [Composer + Macros]   │ [Acoes rapidas]            │
└────────────────┴──────────────────────┴────────────────────────────┘
```

### 3.3 Supervisor Dashboard (Proposta — referencia E08)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER: Central de Supervisao IA                                     │
├─────────────────────────────────────────────────────────────────────┤
│ KPIs: [Conversas Ativas] [Avg Confidence] [Escalacoes Hoje]         │
│       [Tempo Medio Resposta] [CSAT Tempo Real] [KB Gaps]            │
├─────────────────────────────────────────────────────────────────────┤
│ TABS: [Monitoramento Live] [Fila Revisao] [Treino] [Metricas]      │
├─────────────────────────────────────────────────────────────────────┤
│ MONITORAMENTO LIVE:                                                  │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐       │
│ │ Conv #1234   │ Conv #1235   │ Conv #1236   │ Conv #1237   │       │
│ │ LINO - 85%   │ KIRA - 62%⚠ │ Humano       │ LINO - 91%   │       │
│ │ "Como..."    │ "Boleto..."  │ Marcio S.    │ "Backup..."  │       │
│ │ [Ver] [Esc]  │ [Ver] [Esc]  │ [Ver] [Copil]│ [Ver]        │       │
│ └──────────────┴──────────────┴──────────────┴──────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.4 Cliente Unificado (Merge ClientDetail + Customer360)

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER: [<-] Clientes > Empresa XYZ     [Editar] [Health: 78 🟢]  │
├────────────┬───────────────────────────────────────────────────────┤
│ SIDEBAR    │ TABS: [Visao Geral] [Conversas] [Contratos]          │
│ (280px)    │       [Contatos] [Anotacoes] [Atividade]             │
│            │                                                       │
│ Avatar     │ TAB VISAO GERAL:                                      │
│ Nome       │ ┌────────┬────────┬────────┬────────┬────────┐       │
│ Empresa    │ │Health  │NPS     │CSAT    │Tickets │MRR     │       │
│ Produto    │ │78/100  │8       │4.2/5   │23      │R$890   │       │
│ Sistema    │ └────────┴────────┴────────┴────────┴────────┘       │
│            │                                                       │
│ Contato:   │ [Timeline de atividade recente]                       │
│ Phone      │ [Alertas: renovacao, churn risk]                      │
│ Email      │ [Conversas recentes com status]                       │
│ CNPJ       │                                                       │
└────────────┴───────────────────────────────────────────────────────┘
```

---

## 4. Guia de Componentes Atualizado

### 4.1 Tokens de Cor — Aplicacao Obrigatoria

Toda tela deve usar as seguintes classes Tailwind customizadas ou valores diretos:

| Uso | Classe/Valor | Atual (incorreto) |
|-----|-------------|-------------------|
| Titulo principal | `text-[#10293F] dark:text-foreground` | `text-foreground` |
| Tab ativa (borda) | `border-b-[#45E5E5]` | `border-primary` |
| CTA principal | `bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]` | `bg-primary text-primary-foreground` |
| Card hover shadow | `hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)]` | `hover:shadow-md` |
| Badge status info | `bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)]` | variado |
| Badge warning | `bg-[#FFFBEB] text-[#92400E] border-[rgba(255,184,0,0.5)]` | variado |
| Badge error | `bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]` | variado |

### 4.2 Componentes Padrao

| Componente | Padrao Obrigatorio |
|-----------|-------------------|
| Page wrapper | `<div className="page-container"><div className="page-content">` |
| Tabs ativas | `data-[state=active]:border-b-[#45E5E5]` |
| Breadcrumb | Presente em toda tela interna |
| Loading | `<Skeleton>` para layouts, `<Spinner>` para inline |
| Confirmacao destrutiva | `<ConfirmDialog>` sempre antes de delete/action irreversivel |
| Empty state | Icone + mensagem + CTA |
| KPI card | Icon em circle + value grande + subtitle pequeno + hover lift |

---

## 5. Novas Telas Propostas

| Tela | Rota | Descricao | Prioridade | Ref |
|------|------|-----------|-----------|-----|
| **Inbox Unificada** | `/inbox` | Chat-first com lista de conversas + chat + context panel | Alta | Gmail, Intercom |
| **Supervisor Live** | `/supervisor/live` | Monitoramento em tempo real de todas conversas ativas | Alta | E08 |
| **Onboarding Wizard** | `/welcome` | Primeiro acesso — configura instancia WhatsApp, cria agente, etc. | Alta | Intercom |
| **Cliente Unificado** | `/clients/:id` (rewrite) | Merge de ClientDetail + Customer360 | Media | Zendesk |
| **Relatorio SLA** | `/reports/sla` | Dashboard de conformidade SLA com alertas | Media | E17 |
| **Portal do Cliente** | `/help` (rewrite) | Self-service com busca na KB publica | Baixa | E17 |
| **Collision Detection** | (overlay) | Aviso quando 2 agentes veem o mesmo ticket | Baixa | Freshdesk |

---

## 6. Prioridade de Implementacao

### Sprint 1 — Identidade Visual (1-2 semanas)
1. **Aplicar paleta GMS em todas as telas** — substituir tokens genericos por cores GMS explicitas
2. **Padronizar tabs** — borda inferior `#45E5E5` em todas as tabs ativas
3. **Sombras navy** — `rgba(16,41,63,X)` em vez de `rgba(0,0,0,X)`
4. **Login redesign** — background navy, botao cyan
5. **Breadcrumb global** — implementar em todas as paginas internas

### Sprint 2 — Responsividade (1-2 semanas)
6. **ClientDetail mobile** — sidebar colapsavel
7. **Settings** — sidebar vertical em vez de 9 tabs
8. **Tabelas responsive** — card view em mobile para AISettings, Contacts, etc.
9. **Knowledge** — fix `h-screen` e header duplo
10. **Queue** — virtualizar lista

### Sprint 3 — Novas Features UX (2-3 semanas)
11. **Inbox Unificada** — nova tela com 3 paineis
12. **Merge ClientDetail + Customer360**
13. **Queue — confirmacao de "Assumir"**
14. **Loading states** — padronizar Skeleton vs Spinner
15. **Substituir emojis por icones Lucide**

### Sprint 4 — Polish (1-2 semanas)
16. **Supervisor Live** — monitoramento tempo real
17. **Onboarding wizard**
18. **Micro-animacoes** — fadeIn em cards, slideIn em paineis
19. **Acessibilidade** — aria-labels em todos os botoes de icone, focus-visible cyan
20. **Dark mode** — garantir contraste WCAG AA em todas as cores GMS

---

## 7. Conformidade com Design System GMS

### Aderencia Atual por Area

| Area | Aderencia | Comentario |
|------|----------|-----------|
| Paleta de cores | 30% | Apenas Dashboard e Evaluations usam cores GMS diretamente |
| Tipografia (Poppins/Inter) | 20% | Apenas Dashboard aplica `font-[Poppins,...]` |
| Sombras navy | 0% | Todas as sombras usam rgba preto |
| Tabs com cyan | 30% | Dashboard e Evaluations corretos, restante generico |
| Cards com hover lift | 40% | Presente em Macros, ServiceCatalog, mas inconsistente |
| Breadcrumb | 15% | Apenas AgentPlayground, ClientDetail, Customer360 |
| Focus visible cyan | 10% | Shadcn tem focus-ring padrao, nao customizado para cyan |
| Botao CTA cyan | 20% | AISettings usa corretamente, restante generico |
| Loading Skeleton | 60% | Maioria implementa, mas padrao varia |
| Empty states | 70% | Maioria tem icone + mensagem + CTA |

### Meta

Atingir **80%+ de aderencia** ao design system GMS em 4 sprints.

---

## 8. Benchmarks de Referencia

| Feature | WhatsApp | Gmail | ChatGPT | Slack | GMS (Atual) | GMS (Meta) |
|---------|----------|-------|---------|-------|-------------|------------|
| Chat UX | 10/10 | 6/10 | 9/10 | 8/10 | 6/10 | 8/10 |
| Inbox UX | N/A | 10/10 | N/A | 8/10 | 5/10 | 8/10 |
| Busca | 7/10 | 10/10 | 7/10 | 9/10 | 6/10 | 8/10 |
| Notificacoes | 8/10 | 9/10 | 5/10 | 10/10 | 3/10 | 7/10 |
| Onboarding | 8/10 | 7/10 | 9/10 | 9/10 | 2/10 | 7/10 |
| Mobile | 10/10 | 9/10 | 8/10 | 8/10 | 3/10 | 7/10 |

---

*Relatorio gerado em 2026-03-19 pelo Especialista UX/UI Sismais Tecnologia.*
*Proxima revisao: apos Sprint 1 de implementacao.*
