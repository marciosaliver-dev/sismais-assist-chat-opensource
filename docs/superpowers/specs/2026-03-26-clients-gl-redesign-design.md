# Clients & GL Integration Redesign

**Data:** 2026-03-26
**Produto:** Sismais GMS — Helpdesk
**Escopo:** Tela de listagem de clientes (`/clients`), tela de detalhe (`/clients/:id`), sincronização GL

---

## Contexto

A tela de clientes atual exibe dados básicos mas não aproveita todos os campos disponíveis no banco GL (Mais Simples + Maxpro). A listagem não tem ordenação por coluna, não tem indicadores de quantidade por status, e os filtros são limitados. A tela de detalhe exibe informações GL dispersas sem uma visão consolidada. A sincronização GL mapeia campos mas alguns campos novos da tabela (`dias_assinatura`, `ltv_dias`, `dias_status_atual`, `tag`, `engajamento`, etc.) precisam ser verificados e expostos na UI.

---

## 1. Tela de Listagem (`/clients`)

### 1.1 KPI Strip

Cinco cards no topo da página, clicáveis (ativam filtro de status):

| Card | Fonte | Cor destaque |
|------|-------|-------------|
| Total | COUNT(*) | navy |
| Ativos | `status_pessoa = 'Ativo'` ou `license_status = 'active'` | `#16A34A` |
| Bloqueados | `status_pessoa = 'Bloqueado'` | `#DC2626` |
| Trial | `status_pessoa LIKE '%Trial%'` | `#FFB800` |
| Inativos | demais status | `#666666` |

Os contadores devem ser calculados na query de listagem (`helpdesk_clients` + `gl_client_licenses`).

### 1.2 Filtros em linha

Linha abaixo dos KPIs:
- **Busca** (já existe) — mantida, full-width com ícone
- **Status** dropdown — Todos / Ativo / Bloqueado / Trial / Inativo / Gratuita / Cancelado
- **Segmento** dropdown — lista de `nome_segmento` distintos
- **Data** dropdown — Cadastrado em (range: Hoje, 7d, 30d, 90d, personalizado)
- **Mais filtros** dropdown — Dias sem uso (> 30, > 60, > 90), Cidade/UF, Sistema
- **Botão "Colunas"** — popover com checkboxes para mostrar/ocultar colunas extras

### 1.3 Ordenação por coluna

Todas as colunas da tabela devem ter cabeçalho clicável com ícone de seta (`↑` / `↓` / `⇅`). Estado de sort: `{ column: string, direction: 'asc' | 'desc' }` em `useState`. A query de listagem deve aceitar `orderBy` e `orderDir`.

Colunas ordenáveis: Nome, CNPJ, Segmento, Cadastro, Dias Uso, Último Login, Logins, MRR, Engajamento, Dias Instalação, Dias Assinatura, LTV.

### 1.4 Novas colunas do GL

Colunas adicionais (ocultas por padrão, ativáveis via botão "Colunas"):

| Coluna UI | Campo GL | Tipo |
|-----------|----------|------|
| Cidade/UF | `cidade` + `uf` | texto |
| Sistema | `sistema_utilizado` | badge |
| Dias Instalação | `dias_instalacao` | número |
| Dias Assinatura | `dias_assinatura` | número |
| LTV (dias) | `ltv_dias` | número |
| Última Verificação | `ultima_verificacao` | data relativa |
| Início Assinatura | `dt_inicio_assinatura` | data |

Preferência de colunas salva em `localStorage` por usuário.

### 1.5 Tamanho da tela

Remover padding/max-width desnecessários. A tabela deve usar `w-full` e a área de conteúdo deve ocupar toda a viewport disponível. Scroll horizontal na tabela quando colunas extras ativadas.

---

## 2. Tela de Detalhe (`/clients/:id`)

### 2.1 Header / Breadcrumb

- Breadcrumb: `← Clientes › [Nome do Cliente]`
- Badge de status churn/risco visível ao lado do nome
- Botões: `✏ Editar Cliente` + `+ Novo Ticket`

### 2.2 Sidebar compacta (esquerda, ~300px)

Reorganização da sidebar atual:

1. **Avatar + Nome + CNPJ** (centralizado)
2. **Health Score Ring** — mantido, reduzido
3. **Grid 2×2 de KPIs**: Total Tickets | Resolvidos | Dívida | Engajamento
4. **Status GL** — dois badges: MS e MP com cor semântica
5. **Contatos** — lista compacta
6. **Informações de contato**: telefone, email

### 2.3 Nova aba "GL Dados"

Nova aba entre "Contratos" e "Anotações". Exibe todos os campos do GL organizados em seções:

**Seção: Uso do Sistema**
- Dias de Uso, Dias Instalação, Dias Última Verificação, Dias Status Atual, Último Login, Qtd Logins

**Seção: Assinatura**
- Início Assinatura, Dias Assinatura, LTV Dias, Plano, Sistema Utilizado

**Seção: Localização & Segmento**
- Cidade, UF, Segmento, Tag, Engajamento

**Seção: Sincronização**
- Última sincronização GL, Data atualização GL

### 2.4 Melhorias de UX gerais

- Aplicar padrão Sismais completo (topbar navy, cores oficiais, tipografia Poppins/Inter)
- Cards de KPI com `border-top` colorida por categoria
- Status badges com cores semânticas consistentes
- Loading states com skeleton (padrão GMS)
- Mobile-friendly: sidebar colapsa em tela menor

---

## 3. Sincronização GL — Verificação e Correção

### 3.1 Campos a verificar no `gl-sync`

Verificar se os seguintes campos estão sendo mapeados e salvos em `gl_client_licenses`:

| Campo GL | Mapeado atualmente? | Ação |
|----------|--------------------|----|
| `dias_assinatura` | A verificar | Adicionar se ausente |
| `ltv_dias` | A verificar | Adicionar se ausente |
| `dias_status_atual` | A verificar | Adicionar se ausente |
| `tag` | A verificar | Adicionar se ausente |
| `engajamento` | A verificar | Adicionar se ausente |
| `dt_inicio_assinatura` | A verificar | Adicionar se ausente |
| `sistema_utilizado` | A verificar | Confirmar |

### 3.2 `client-unified-search`

Garantir que os novos campos sejam retornados na busca unificada e na listagem paginada.

### 3.3 `customer-360`

Garantir que a edge function `customer-360` retorne os campos GL extras para exibição na aba "GL Dados".

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/clients/ClientUnifiedSearch.tsx` | KPI strip, filtros em linha, ordenação, novas colunas, toggle de colunas |
| `src/components/clients/ClientFullView.tsx` | Nova aba GL Dados, botão Novo Ticket no header |
| `src/components/clients/ClientSidebar.tsx` | Compactar sidebar, grid KPIs, remover redundâncias |
| `src/hooks/useClientUnifiedSearch.ts` | Passar params de sort, filtros, colunas |
| `supabase/functions/gl-sync/index.ts` | Adicionar campos faltantes no mapeamento |
| `supabase/functions/client-unified-search/index.ts` | Retornar novos campos, suportar sort/filter |
| `supabase/functions/customer-360/index.ts` | Retornar campos GL extras |

---

## Verificação

1. `npm run dev` — acessar `/clients` e confirmar KPI strip, filtros, ordenação
2. Clicar em um cliente e confirmar nova aba "GL Dados" com todos os campos
3. Ativar colunas extras via botão "Colunas" e confirmar visibilidade + persistência em localStorage
4. Filtrar por status e confirmar que KPI strip atualiza corretamente
5. Verificar no Supabase que `gl_client_licenses` contém os novos campos após sync
