# Design Spec: Portal de Manuais Internos

**Data:** 2026-03-23
**Status:** Aprovado
**Autor:** Claude + Marcio

---

## Visão Geral

Criar um portal de manuais internos para usuários do sistema (operadores, agentes humanos, admins) com UI premium estilo Intercom Help. Acessível via sidebar do app logado na rota `/manual`. Reutiliza os 31 artigos existentes na `ai_knowledge_base` com uma experiência visual step-by-step.

**Não confundir com:** Help Center público (`/help-center`) que é para clientes externos.

---

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Localização | Dentro do app logado, item na sidebar |
| Estilo visual | Intercom Help — grid de categorias, busca proeminente |
| Visualização de artigos | Step-by-step interativo com progresso visual |
| Dados | Reutiliza `ai_knowledge_base` (`category = 'manual'` AND `is_active = true`) |
| Agrupamento | Por `knowledge_products` (módulos do sistema) |
| Rota | `/manual` (home) + `/manual/:id` (artigo) |

---

## Rotas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/manual` | `ManualHome.tsx` | Home com busca + grid de módulos + lista de artigos |
| `/manual/:id` | `ManualArticleViewer.tsx` | Visualizador step-by-step do artigo |

**Sidebar:** Ícone `BookOpen` (lucide-react) + label "Manuais". Registrar na sidebar do `MainLayout`, posicionado após Settings.

---

## Filtragem de Dados

### Colunas existentes utilizadas

| Coluna | Tipo | Uso |
|--------|------|-----|
| `category` | string | Filtrar por `'manual'` para distinguir de outros tipos de knowledge |
| `is_active` | boolean | Apenas artigos ativos |
| `product_id` | FK → knowledge_products | Agrupar por módulo (Dashboard, Inbox, etc.) |
| `group_id` | FK → knowledge_groups | Sub-agrupamento opcional |
| `content_html` | string | Conteúdo renderizado (preferido). Fallback: `content` |
| `tags` | string[] | Pode conter tags de dificuldade ("iniciante", "intermediario", "avancado") |
| `helpful_count` / `not_helpful_count` | number | Feedback direto (increment via RPC ou update) |
| `description` | string | Preview na lista de artigos |

### Dificuldade

Derivada da array `tags[]`: se contém "iniciante", "intermediario" ou "avancado", exibe badge. Se nenhum, omite badge.

### Contagem de Steps

Calculada em runtime: contar ocorrências de `<h2>` ou `<h3>` no `content_html`. Não precisa de coluna extra.

### Ordenação Prev/Next

Artigos do mesmo `product_id`, ordenados por `title ASC`. Primeiro e último artigos mostram apenas um botão (next ou prev).

---

## ManualHome (`/manual`)

### Layout (de cima para baixo)

#### 1. Header Hero
- Fundo navy (`#10293F`), altura ~160px
- Título "Central de Manuais" em branco, font Poppins 24px bold
- Subtítulo "Aprenda a usar cada recurso do sistema" em branco/70%
- Campo de busca grande centralizado (max-width 500px), fundo branco, ícone Search
- Busca: Supabase `ilike` em `title` e `description` com debounce 300ms

#### 2. Grid de Módulos
- Grid responsivo: 4 colunas desktop, 3 tablet, 2 mobile
- Cada card:
  - Ícone do módulo (lucide-react) com fundo colorido (cor do `knowledge_products.color`)
  - Nome do módulo (ex: "Dashboard", "Inbox", "Agentes IA")
  - Contagem de artigos (ex: "10 artigos")
  - Hover: translateY(-2px) + shadow cyan
  - Click: filtra lista de artigos abaixo por esse módulo

#### 3. Filtros
- Chips horizontais: "Todos" + cada módulo
- Chip ativo: fundo cyan, texto navy
- Chip inativo: fundo gray-100, texto gray-700

#### 4. Lista de Artigos
- Cards em lista vertical (1 coluna, full width)
- Cada card:
  - Ícone do tipo à esquerda
  - Título do artigo (font 15px, semibold, navy)
  - Descrição truncada (1 linha, gray-500)
  - Badge de dificuldade se disponível em tags (direita)
  - Badge de steps count (ex: "8 passos", calculado do content_html)
  - Hover: background gray-100 + border-left cyan
  - Click: navega para `/manual/:id`

### Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton: 8 cards retangulares animados no grid + 4 linhas skeleton na lista |
| Erro | Card centralizado com ícone AlertCircle, mensagem "Erro ao carregar manuais", botão "Tentar novamente" |
| Vazio (sem artigos) | Ilustração + "Nenhum manual disponível ainda" |
| Busca sem resultado | "Nenhum resultado para '[termo]'" com sugestão de limpar filtro |

---

## ManualArticleViewer (`/manual/:id`)

### Layout

#### 1. Breadcrumb
- "Manuais > [Módulo] > [Título]"
- Links clicáveis de volta

#### 2. Header do Artigo
- Título grande (Poppins 22px bold, navy)
- Linha de metadados: badge módulo + badge dificuldade (se tags contiver) + "X passos" + tempo estimado (word count / 200 wpm, arredondado)
- Separador sutil

#### 3. Barra de Progresso (sticky)
- Fixa no topo ao scrollar (z-index 50)
- Mostra: "Passo X de Y" + progress bar visual
- Progress bar: fundo gray-200, preenchimento cyan, transição suave
- Usa Intersection Observer para detectar step visível

#### 4. Steps Visuais
- Cada step é um bloco:
  - Número circular grande (40px, fundo cyan, texto navy, font bold)
  - Título do step (16px semibold)
  - Conteúdo HTML renderizado com sanitização via DOMPurify, tipografia limpa
  - Screenshots/imagens com border-radius 8px e shadow
  - Separador: linha pontilhada vertical conectando os números
- Step ativo: número com shadow cyan, conteúdo com opacity 1
- Steps futuros: opacity 0.6 até scroll

#### 5. Sidebar Table of Contents (direita, colapsável)
- Largura: 220px desktop, hidden mobile (vira dropdown fixo no topo em telas < 768px)
- Lista de steps com números
- Step atual: highlighted com fundo cyan-light, texto navy, font bold
- Click no step: scroll suave até o bloco

#### 6. Navegação Prev/Next
- Rodapé com 2 cards lado a lado
- "← Artigo anterior" | "Próximo artigo →"
- Mostra título do artigo vizinho no mesmo módulo (ordenado por title ASC)
- Primeiro artigo: só mostra "Próximo". Último: só mostra "Anterior"

#### 7. Feedback
- "Este artigo foi útil?" com thumbs up/down
- Incrementa `helpful_count` ou `not_helpful_count` diretamente na `ai_knowledge_base`
- Salva preferência em localStorage (`manual_feedback_{id}`) para evitar voto duplicado
- Animação de agradecimento após voto

### Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton com blocos de step animados |
| Erro | Card com mensagem + botão voltar para `/manual` |
| 404 (ID inválido) | "Artigo não encontrado" + link para `/manual` |
| Sem headings (fallback) | Renderiza conteúdo como artigo contínuo sem steps/progresso |

---

## Parsing de Steps

Os artigos armazenam conteúdo em `content_html` (preferido) ou `content` (fallback markdown).

**Estratégia de parsing:**
1. Usar `content_html` se disponível, senão `content`
2. Parsear por `<h2>` como delimitador primário de steps
3. Se não há `<h2>`, tentar `<h3>`
4. Se não há headings HTML, tentar `## ` (markdown h2)
5. **Fallback:** se nenhum heading encontrado, renderizar como artigo contínuo (sem numeração de steps, sem progress bar)
6. Cada heading vira título do step, conteúdo entre headings vira corpo do step

---

## Componentes Novos

| Componente | Caminho | Função |
|-----------|---------|--------|
| `ManualHome.tsx` | `src/pages/` | Página home do manual |
| `ManualArticleViewer.tsx` | `src/pages/` | Visualizador de artigo step-by-step |
| `ManualModuleCard.tsx` | `src/components/manual/` | Card de módulo no grid |
| `ManualArticleCard.tsx` | `src/components/manual/` | Item de artigo na lista |
| `ManualStepBlock.tsx` | `src/components/manual/` | Bloco visual de cada step |
| `ManualProgressBar.tsx` | `src/components/manual/` | Barra de progresso sticky |
| `ManualTableOfContents.tsx` | `src/components/manual/` | Sidebar TOC |
| `ManualSearchBar.tsx` | `src/components/manual/` | Busca com debounce |
| `useManualArticles.ts` | `src/hooks/` | Hook para buscar artigos internos |

---

## Hook: useManualArticles

```typescript
// Query: ai_knowledge_base WHERE category='manual' AND is_active=true
// Join: knowledge_products (product_id) para nome, cor, ícone do módulo
// Filtros opcionais: productId, search (ilike title/description)
// Retorna: { articles, products (com contagem), isLoading, error }
//
// useManualArticle(id): busca artigo individual + produto associado
// Retorna: { article, product, isLoading, error, isNotFound }
```

---

## Identidade Visual GMS

- Paleta: navy, cyan, yellow + neutros conforme CLAUDE.md
- Texto sobre cyan: sempre navy
- Sombras: sempre rgba(16,41,63,X)
- Tipografia: Poppins headings, Inter body (via Tailwind config existente)
- Ícones: lucide-react (consistente com resto do app React)
- Focus visible: outline 2px cyan
- Hover: translateY + shadow
- Border-radius: 8px cards, 6px inputs, 9999px badges

---

## Fora do Escopo

- Editor de manuais (já existe em AdminManualEditor)
- Geração de conteúdo com IA (já existe em ai-article-assistant)
- Help Center público (rotas /help-center separadas)
- Vídeos (podem ser adicionados depois)
- Migrations de banco (usa colunas existentes)
