# KB Roadmap — Task Breakdown (helpdesk-dev-squad)

**Data:** 2026-03-30 | **Origem:** [KB Report v1 — step-06-kb-report.md](../../../agentes_sismais/squads/@thuliobittencourt/support-knowledge-squad/output/v1/step-06-kb-report.md)
**Squad:** helpdesk-dev-squad | **Produto:** Mais Simples — Atendimento Inteligente

---

## Fase 1 — Fundacao (Sprint 1-2)

### Sprint 1: RAG Sync + Taxonomia

- [ ] **TASK-001: Criar migration para 7 categorias L1 em knowledge_products**
  - **Descricao:** Inserir as 7 categorias L1 definidas na taxonomia (Primeiros Passos, Atendimento & Tickets, Agentes IA & Automacoes, Base de Conhecimento & Manuais, WhatsApp & Canais, CRM & Clientes, Configuracoes & Sistema) como registros na tabela `knowledge_products` com slugs semanticos.
  - **Arquivos:**
    - `supabase/migrations/<timestamp>_kb_taxonomy_l1_categories.sql` (novo)
    - `supabase/migrations/20260305120000_knowledge_products_and_groups.sql` (referencia de schema)
  - **Criterios de aceite:**
    - 7 registros L1 existem em `knowledge_products` apos rodar a migration
    - Cada registro possui `slug`, `name`, `priority` e `audience` preenchidos
    - Migration e idempotente (INSERT ... ON CONFLICT DO NOTHING)
  - **Esforco:** S
  - **Dependencias:** Nenhuma

- [ ] **TASK-002: Criar migration para subcategorias L2 em knowledge_groups**
  - **Descricao:** Inserir as 31 subcategorias L2 mapeadas no report, vinculadas aos respectivos L1 via `product_id` na tabela `knowledge_groups`.
  - **Arquivos:**
    - `supabase/migrations/<timestamp>_kb_taxonomy_l2_subcategories.sql` (novo)
    - `supabase/migrations/20260305120000_knowledge_products_and_groups.sql` (referencia de schema)
  - **Criterios de aceite:**
    - 31 registros L2 existem em `knowledge_groups` vinculados corretamente aos L1
    - Cada registro possui `slug`, `name` e `product_id` valido
    - Query `SELECT count(*) FROM knowledge_groups WHERE product_id IN (SELECT id FROM knowledge_products)` retorna 31
  - **Esforco:** S
  - **Dependencias:** TASK-001

- [ ] **TASK-003: Fix knowledge-base-sync — completar stale detection e gap suggestions**
  - **Descricao:** A edge function `knowledge-base-sync` esta 40% implementada. Completar com: deteccao de conteudo stale (>90 dias sem revisao), sugestoes de gaps (features sem artigo), logging em `kb_sync_log` e tratamento de erros.
  - **Arquivos:**
    - `supabase/functions/knowledge-base-sync/index.ts`
  - **Criterios de aceite:**
    - Artigos sem revisao >90 dias sao marcados com flag `stale = true`
    - Artigos com feedback negativo >20% entram em fila de revisao prioritaria
    - Toda execucao grava log em tabela `kb_sync_log` com status e detalhes de erro
    - Funcao retorna JSON com `{ synced, stale_detected, gaps_found, errors }`
  - **Esforco:** M
  - **Dependencias:** Nenhuma

- [ ] **TASK-004: Adicionar retry logic (2x backoff) na geracao de embeddings**
  - **Descricao:** Atualmente a geracao de embeddings e fire-and-forget sem tratamento de erro. Adicionar retry com backoff exponencial (2 tentativas) e alerta em caso de falha persistente.
  - **Arquivos:**
    - `supabase/functions/generate-embedding/index.ts`
  - **Criterios de aceite:**
    - Em caso de falha na API OpenRouter, retry automatico com delay de 1s e depois 3s
    - Apos 2 retries sem sucesso, erro e logado com `article_id` e mensagem de erro
    - Resposta da funcao inclui `{ success, retries_used, error_message? }`
    - Teste manual: simular timeout e verificar que retry acontece
  - **Esforco:** S
  - **Dependencias:** Nenhuma

- [ ] **TASK-005: Habilitar RAG_SEMANTIC_CHUNKING no document-processor**
  - **Descricao:** O `document-processor` possui flag `RAG_SEMANTIC_CHUNKING` mas usa chunking fixo. Ativar chunking semantico por secao (H2/H3) com chunks de 200-400 tokens e overlap de 50 tokens.
  - **Arquivos:**
    - `supabase/functions/document-processor/index.ts`
  - **Criterios de aceite:**
    - Flag `RAG_SEMANTIC_CHUNKING=true` ativa chunking por H2/H3
    - Chunks gerados tem entre 200-400 tokens com overlap de 50
    - Tabelas nunca sao cortadas entre chunks
    - Chunks < 50 tokens sao descartados
    - Teste: processar artigo com 3 secoes H2 e verificar 3+ chunks semanticos
  - **Esforco:** M
  - **Dependencias:** Nenhuma

- [ ] **TASK-006: Adicionar trigger automatico de re-embedding on publish/update**
  - **Descricao:** Criar database trigger que dispara re-geracao de embeddings automaticamente quando um artigo e publicado ou atualizado, chamando a edge function `generate-embedding`.
  - **Arquivos:**
    - `supabase/migrations/<timestamp>_kb_auto_reembed_trigger.sql` (novo)
    - `supabase/functions/generate-embedding/index.ts` (ajustar para aceitar webhook trigger)
  - **Criterios de aceite:**
    - UPDATE em artigo com status `published` dispara re-embedding automatico
    - INSERT com status `published` dispara embedding inicial
    - Artigos em `draft` ou `archived` NAO disparam embedding
    - Log de execucao do trigger verificavel em `kb_sync_log`
  - **Esforco:** M
  - **Dependencias:** TASK-004

- [ ] **TASK-007: Reduzir threshold do learning loop de 0.85 para 0.70**
  - **Descricao:** O learning loop atual exige `confidence >= 0.85` para considerar uma resposta RAG como valida, descartando muitas respostas uteis. Reduzir para 0.70 como valor inicial.
  - **Arquivos:**
    - `supabase/functions/learning-loop/index.ts`
  - **Criterios de aceite:**
    - Threshold de confianca alterado de 0.85 para 0.70
    - Valor e configuravel via variavel de ambiente `LEARNING_LOOP_THRESHOLD`
    - Teste: resposta com confidence 0.72 e aceita pelo loop (antes seria rejeitada)
  - **Esforco:** S
  - **Dependencias:** Nenhuma

### Sprint 2: Artigos + Quick Wins

- [ ] **TASK-008: Publicar 32 artigos iniciais (bulk insert com embeddings)**
  - **Descricao:** Inserir os 32 artigos produzidos pelo KB Writer (5 How-To, 20 FAQ, 3 Troubleshooting, 2 Tutoriais, 2 Procedimentos Internos) com metadados completos e gerar embeddings para os 30 artigos publicos.
  - **Arquivos:**
    - `supabase/migrations/<timestamp>_kb_seed_32_articles.sql` (novo)
    - `supabase/functions/generate-embedding/index.ts` (chamada em batch)
  - **Criterios de aceite:**
    - 32 artigos inseridos com `category_l1`, `category_l2`, `template_type`, `tags`, `audience_tier`
    - 30 artigos publicos possuem embeddings gerados (2 procedimentos internos com `rag_chunks: false`)
    - Todos os Top 10 issues possuem pelo menos 1 artigo vinculado
    - Artigos acessiveis via query `SELECT * FROM knowledge_articles WHERE status = 'published'`
  - **Esforco:** L
  - **Dependencias:** TASK-001, TASK-002, TASK-006

- [ ] **TASK-009: Adicionar datas "Ultima atualizacao" visiveis nos artigos**
  - **Descricao:** Exibir data de ultima atualizacao nos viewers de artigos para transmitir confianca ao usuario sobre a relevancia do conteudo.
  - **Arquivos:**
    - `src/pages/ManualArticleViewer.tsx`
    - `src/pages/HelpManualViewer.tsx`
    - `src/pages/HelpContentViewer.tsx`
  - **Criterios de aceite:**
    - Data "Ultima atualizacao: DD/MM/YYYY" visivel abaixo do titulo do artigo
    - Formato brasileiro (DD/MM/YYYY)
    - Artigos sem data de atualizacao mostram data de criacao
  - **Esforco:** S
  - **Dependencias:** Nenhuma

- [ ] **TASK-010: Fix MANUAL_PRODUCT_ID hardcoded em useManualArticles.ts**
  - **Descricao:** O hook `useManualArticles` possui um `MANUAL_PRODUCT_ID` hardcoded que impede a filtragem dinamica por categoria. Refatorar para aceitar `productId` como parametro.
  - **Arquivos:**
    - `src/hooks/useManualArticles.ts`
    - `src/pages/ManualHome.tsx` (ajustar chamada)
    - `src/pages/HelpManuals.tsx` (ajustar chamada)
  - **Criterios de aceite:**
    - `useManualArticles` aceita `productId` como parametro opcional
    - Quando `productId` nao e passado, busca todos os artigos publicos
    - Paginas existentes continuam funcionando sem regressao
    - Nenhum UUID hardcoded permanece no hook
  - **Esforco:** S
  - **Dependencias:** Nenhuma

- [ ] **TASK-011: Melhorar componente "Foi util?" com tracking**
  - **Descricao:** O feedback de artigos ("Foi util? Sim/Nao") precisa gravar metricas no banco para alimentar o dashboard de analytics e o loop KCS Evolve.
  - **Arquivos:**
    - `src/pages/ManualArticleViewer.tsx` (componente de feedback)
    - `src/pages/HelpContentViewer.tsx` (componente de feedback)
    - `supabase/migrations/<timestamp>_kb_article_feedback.sql` (novo — tabela de feedback)
  - **Criterios de aceite:**
    - Clique em "Sim" ou "Nao" grava registro em `kb_article_feedback` com `article_id`, `vote`, `user_id`, `created_at`
    - Feedback negativo permite campo opcional de comentario (max 500 chars)
    - Artigo mostra contagem agregada "X de Y acharam util" (apenas para admins)
    - Duplo voto do mesmo usuario no mesmo artigo e ignorado
  - **Esforco:** M
  - **Dependencias:** Nenhuma

---

## Fase 2 — Unificacao (Sprint 3-4)

### Sprint 3: Editor Unificado

- [ ] **TASK-012: Unificar /knowledge e /admin/manuais em interface unica**
  - **Descricao:** Atualmente existem dois editores paralelos — `/knowledge` (Knowledge.tsx/KnowledgeBase.tsx) e a aba de manuais no admin (ManuaisTab.tsx). Unificar em uma interface unica com suporte a markdown + WYSIWYG e a taxonomia L1/L2.
  - **Arquivos:**
    - `src/pages/Knowledge.tsx` (refatorar como interface principal)
    - `src/pages/KnowledgeBase.tsx` (consolidar)
    - `src/components/knowledge/ManuaisTab.tsx` (migrar funcionalidades)
    - `src/components/knowledge/ProductSidebar.tsx` (adaptar para L1/L2)
    - `src/components/knowledge/DocumentCard.tsx` (adaptar para artigos)
    - `src/components/manuals/RichTextEditor.tsx` (integrar)
    - `src/App.tsx` (ajustar rotas)
  - **Criterios de aceite:**
    - Interface unica acessivel em `/knowledge` com sidebar de categorias L1/L2
    - Editor suporta markdown e WYSIWYG toggle
    - Todas funcionalidades de ambos editores estao disponiveis
    - Rota `/admin/manuais` redireciona para `/knowledge`
    - Nenhuma perda de dados durante a migracao
  - **Esforco:** L
  - **Dependencias:** TASK-001, TASK-002

- [ ] **TASK-013: Implementar workflow draft -> review -> publish**
  - **Descricao:** Criar fluxo de publicacao com 3 estados (draft, review, published) com SLAs automatizados e notificacoes para revisores.
  - **Arquivos:**
    - `supabase/migrations/<timestamp>_kb_article_workflow.sql` (novo — campos status, reviewer, SLA)
    - `src/pages/Knowledge.tsx` (UI de workflow)
    - `src/components/knowledge/DocumentCard.tsx` (badges de status)
  - **Criterios de aceite:**
    - Artigo criado inicia como `draft`
    - Botao "Enviar para revisao" muda status para `review` e registra `submitted_at`
    - Revisor pode aprovar (status `published`) ou rejeitar (volta para `draft` com comentario)
    - Artigos em `review` > 2 dias uteis geram alerta visual no dashboard
    - Historico de transicoes de status e preservado
  - **Esforco:** M
  - **Dependencias:** TASK-012

- [ ] **TASK-014: Criar dashboard de analytics de conteudo (views, helpfulness, stale)**
  - **Descricao:** Dashboard para gestores visualizarem metricas de saude da KB: artigos mais vistos, taxa de utilidade, artigos stale, buscas sem resultado.
  - **Arquivos:**
    - `src/pages/KnowledgeAnalytics.tsx` (novo)
    - `src/components/knowledge/StatsCards.tsx` (expandir)
    - `src/App.tsx` (adicionar rota `/knowledge/analytics`)
    - `supabase/migrations/<timestamp>_kb_analytics_views.sql` (novo — tabela de views e funcoes agregadas)
  - **Criterios de aceite:**
    - Cards de resumo: total artigos, % stale, feedback positivo medio, buscas sem resultado
    - Tabela de artigos ordenavel por views, helpfulness rate, dias desde ultima revisao
    - Filtros por L1, status e periodo
    - Highlight visual para artigos stale (>90 dias) e com feedback negativo >20%
    - Dados atualizados em tempo real via Supabase realtime
  - **Esforco:** L
  - **Dependencias:** TASK-011, TASK-003

### Sprint 4: Help Contextual

- [ ] **TASK-015: Componente \<ContextualHelp\> para help bubbles no app**
  - **Descricao:** Criar componente reutilizavel `<ContextualHelp articleId="HT-XXX" />` que renderiza icone `?` com tooltip/popover contendo resumo do artigo e link para o artigo completo.
  - **Arquivos:**
    - `src/components/help/ContextualHelp.tsx` (novo)
    - `src/hooks/useArticleSummary.ts` (novo — busca resumo do artigo por ID)
  - **Criterios de aceite:**
    - Componente aceita `articleId` e renderiza icone `?` discreto
    - Ao clicar, exibe popover com titulo + primeiros 150 chars + link "Ver artigo completo"
    - Popover fecha ao clicar fora
    - Loading state enquanto busca o artigo
    - Fallback gracioso se artigo nao existe (icone oculto)
  - **Esforco:** M
  - **Dependencias:** TASK-008

- [ ] **TASK-016: Integrar help contextual em 6 rotas prioritarias**
  - **Descricao:** Adicionar `<ContextualHelp>` nas 6 paginas de maior trafego/duvida: Dashboard, Inbox, Kanban, Agentes IA, Knowledge Base e Configuracoes.
  - **Arquivos:**
    - `src/pages/Dashboard.tsx` (ou equivalente)
    - `src/components/inbox/ChatArea.tsx`
    - `src/components/tickets/KanbanBoard.tsx`
    - `src/pages/Agents.tsx`
    - `src/pages/Knowledge.tsx`
    - `src/pages/Settings.tsx` (ou equivalente)
  - **Criterios de aceite:**
    - Cada pagina tem pelo menos 1 `<ContextualHelp>` vinculado a artigo relevante
    - Help bubbles nao interferem no layout existente
    - Posicionamento consistente (canto superior direito do header da pagina)
    - Artigos vinculados cobrem os Top 10 issues relevantes para cada rota
  - **Esforco:** S
  - **Dependencias:** TASK-015

- [ ] **TASK-017: Ativar chunking semantico (H2/H3) no pipeline**
  - **Descricao:** Migrar o pipeline de producao para usar chunking semantico como padrao, garantindo que artigos existentes sejam re-processados com o novo metodo.
  - **Arquivos:**
    - `supabase/functions/document-processor/index.ts`
    - `supabase/functions/knowledge-base-sync/index.ts`
  - **Criterios de aceite:**
    - `RAG_SEMANTIC_CHUNKING` e `true` como default em producao
    - Script de migracao re-processa todos os 32+ artigos existentes
    - Metadados por chunk incluem: `article_id`, `article_title`, `l1_category`, `tags[]`, `audience_tier`
    - Chunks antigos (fixos) sao substituidos pelos novos (semanticos)
    - Busca RAG retorna resultados com qualidade igual ou superior apos migracao
  - **Esforco:** M
  - **Dependencias:** TASK-005, TASK-008

---

## Fase 3 — Diferenciacao (Sprint 5-6)

### Sprint 5: Busca RAG Conversacional

- [ ] **TASK-018: Unificar /manual e /help/manuals em interface unica**
  - **Descricao:** As paginas `/manual/*` (ManualHome, ManualArticleViewer) e `/help/manuals/*` (HelpManuals, HelpManualViewer) sao interfaces separadas com navegacao fragmentada. Unificar em uma unica interface com taxonomia L1 e breadcrumbs.
  - **Arquivos:**
    - `src/pages/ManualHome.tsx` (refatorar como interface principal)
    - `src/pages/ManualArticleViewer.tsx` (consolidar)
    - `src/pages/HelpManuals.tsx` (migrar e redirecionar)
    - `src/pages/HelpManualViewer.tsx` (migrar e redirecionar)
    - `src/components/manual/ManualModuleCard.tsx` (adaptar para L1/L2)
    - `src/App.tsx` (ajustar rotas, redirects)
  - **Criterios de aceite:**
    - Interface unica em `/help/manuals` com navegacao L1 > L2 > Artigo
    - Breadcrumbs navegaveis em todas as paginas
    - Rota `/manual/*` redireciona para `/help/manuals/*`
    - Busca integrada no topo da pagina
    - Nenhuma URL publica quebrada (redirects 301)
  - **Esforco:** L
  - **Dependencias:** TASK-001, TASK-002

- [ ] **TASK-019: Implementar busca unificada 3 camadas (RAG + FTS + autocomplete)**
  - **Descricao:** Busca que combina 3 estrategias: RAG conversacional (pgvector + re-ranking), full-text search (tsvector) e autocomplete para sugestoes instantaneas.
  - **Arquivos:**
    - `src/components/manual/ManualSearchBar.tsx` (refatorar)
    - `src/hooks/useUnifiedSearch.ts` (novo)
    - `supabase/functions/unified-search/index.ts` (novo — orquestra 3 camadas)
    - `supabase/migrations/<timestamp>_kb_fts_index.sql` (novo — indice tsvector)
  - **Criterios de aceite:**
    - Digitacao mostra autocomplete apos 2 caracteres (debounce 300ms)
    - Enter executa busca RAG semantica com re-ranking
    - Fallback para full-text search se RAG retorna 0 resultados
    - Resultados mostram titulo, categoria L1, snippet com highlight e score
    - Latencia < 500ms para autocomplete, < 2s para busca RAG
  - **Esforco:** L
  - **Dependencias:** TASK-017, TASK-018

- [ ] **TASK-020: Persistir historico do AI Chat no banco**
  - **Descricao:** O AI Chat (`HelpAIChat.tsx`) nao persiste historico entre sessoes. Salvar conversas no banco para permitir continuidade e analytics.
  - **Arquivos:**
    - `src/pages/HelpAIChat.tsx`
    - `src/components/manuals/AIManualChat.tsx`
    - `supabase/migrations/<timestamp>_kb_chat_history.sql` (novo — tabela de historico)
  - **Criterios de aceite:**
    - Cada mensagem do chat e salva com `session_id`, `role`, `content`, `created_at`
    - Usuario volta ao chat e ve historico das ultimas 50 mensagens da sessao
    - Sessoes expiram apos 24h de inatividade
    - Admin pode visualizar sessoes para analytics (buscas sem resposta, temas recorrentes)
  - **Esforco:** M
  - **Dependencias:** Nenhuma

### Sprint 6: Inteligencia

- [ ] **TASK-021: Artigos populares por algoritmo (60% views + 30% feedback + 10% recencia)**
  - **Descricao:** Substituir lista estatica de artigos populares por algoritmo ponderado que combina visualizacoes, feedback positivo e recencia.
  - **Arquivos:**
    - `src/pages/ManualHome.tsx` (ou interface unificada)
    - `supabase/migrations/<timestamp>_kb_popular_articles_function.sql` (novo — funcao SQL)
  - **Criterios de aceite:**
    - Funcao SQL `get_popular_articles(limit, category?)` retorna artigos ranqueados
    - Pesos: 60% views (normalizado), 30% helpfulness rate, 10% recencia (decay 30 dias)
    - Home da KB exibe "Artigos Populares" com top 6
    - Filtro opcional por categoria L1
    - Artigos com 0 views nao aparecem na lista
  - **Esforco:** M
  - **Dependencias:** TASK-014, TASK-018

- [ ] **TASK-022: Artigos relacionados via cross-linking semantico**
  - **Descricao:** Exibir ate 5 artigos relacionados ao final de cada artigo, calculados por similaridade de embeddings (cosine similarity).
  - **Arquivos:**
    - `src/pages/ManualArticleViewer.tsx` (ou interface unificada)
    - `src/hooks/useRelatedArticles.ts` (novo)
    - `supabase/migrations/<timestamp>_kb_related_articles_function.sql` (novo — funcao SQL com pgvector)
  - **Criterios de aceite:**
    - Funcao SQL `get_related_articles(article_id, limit=5)` usa cosine similarity
    - Artigos do mesmo L1 recebem boost de 10% no score
    - Artigos arquivados ou draft sao excluidos
    - Secao "Artigos Relacionados" aparece ao final do viewer com cards clicaveis
    - Maximo de 5 artigos relacionados por artigo
  - **Esforco:** M
  - **Dependencias:** TASK-017

- [ ] **TASK-023: Loops KCS automatizados (Solve + Evolve)**
  - **Descricao:** Implementar os dois loops KCS: Solve (agente cria rascunho ao resolver ticket sem artigo) e Evolve (mensal — promover rascunhos, revisar artigos com feedback negativo).
  - **Arquivos:**
    - `supabase/functions/learning-loop/index.ts` (expandir)
    - `supabase/functions/knowledge-base-sync/index.ts` (integrar)
    - `supabase/migrations/<timestamp>_kb_kcs_loops.sql` (novo — tabelas de tracking)
  - **Criterios de aceite:**
    - **Solve:** Ao fechar ticket, se nenhum artigo KB foi vinculado, prompt para agente criar rascunho
    - **Evolve:** Job mensal identifica: artigos com feedback negativo >15%, rascunhos que resolveram 5+ tickets, padroes de tickets sem artigo
    - Relatorio Evolve gera lista de acoes pendentes visivel no dashboard de analytics
    - Rascunhos "nascidos de ticket" possuem link para o ticket de origem
  - **Esforco:** L
  - **Dependencias:** TASK-011, TASK-013

---

## Fase 4 — Escala (Sprint 7+)

- [ ] **TASK-024: Governanca trimestral com owners por L1**
  - **Descricao:** Atribuir um owner (responsavel) para cada categoria L1 e implementar revisao trimestral obrigatoria de todos os artigos sob sua responsabilidade.
  - **Arquivos:**
    - `supabase/migrations/<timestamp>_kb_category_owners.sql` (novo — campo owner_id em knowledge_products)
    - `src/pages/KnowledgeAnalytics.tsx` (secao de governanca)
  - **Criterios de aceite:**
    - Cada L1 tem campo `owner_id` (FK para profiles)
    - Dashboard mostra status de revisao por L1 com indicador de saude
    - Alerta automatico 7 dias antes do prazo trimestral
    - Owner pode marcar revisao como concluida com checklist
  - **Esforco:** M
  - **Dependencias:** TASK-014

- [ ] **TASK-025: Learning loop adaptativo por categoria**
  - **Descricao:** Tornar o threshold do learning loop dinamico — categorias com mais dados de feedback usam threshold ajustado automaticamente com base na media historica.
  - **Arquivos:**
    - `supabase/functions/learning-loop/index.ts`
    - `supabase/migrations/<timestamp>_kb_adaptive_thresholds.sql` (novo — tabela de thresholds por L1)
  - **Criterios de aceite:**
    - Threshold por categoria e calculado como: `media_confianca_ultimos_30_dias * 0.85`
    - Minimo absoluto de 0.60, maximo de 0.90
    - Recalculo automatico semanal
    - Categorias novas (< 20 interacoes) usam threshold global (0.70)
  - **Esforco:** M
  - **Dependencias:** TASK-007, TASK-023

- [ ] **TASK-026: Deteccao automatica de stale com alertas**
  - **Descricao:** Sistema automatizado que detecta artigos stale por multiplos criterios e envia alertas aos owners via notificacao no app e/ou Discord.
  - **Arquivos:**
    - `supabase/functions/knowledge-base-sync/index.ts` (expandir stale detection)
    - `supabase/migrations/<timestamp>_kb_stale_alerts.sql` (novo — tabela de alertas)
  - **Criterios de aceite:**
    - Artigo sem revisao >90 dias → alerta "Revisar"
    - Artigo sem revisao >120 dias → rebaixar ranqueamento RAG em 30% automaticamente
    - Feedback negativo >20% nos ultimos 30 dias → alerta prioritario
    - Zero views em 60 dias → alerta "Avaliar encontrabilidade"
    - Release note menciona feature coberta → alerta com SLA 48h
    - Alertas visiveis no dashboard de analytics e opcionalmente no Discord
  - **Esforco:** L
  - **Dependencias:** TASK-003, TASK-014, TASK-024

- [ ] **TASK-027: Sugestao de artigos via analise de tickets**
  - **Descricao:** Analisar tickets resolvidos para identificar padroes recorrentes sem artigo KB correspondente e sugerir automaticamente novos artigos.
  - **Arquivos:**
    - `supabase/functions/learning-loop/index.ts` (expandir)
    - `supabase/migrations/<timestamp>_kb_article_suggestions.sql` (novo — tabela de sugestoes)
  - **Criterios de aceite:**
    - Job semanal analisa tickets fechados dos ultimos 7 dias
    - Agrupa tickets por similaridade semantica (embeddings dos assuntos)
    - Clusters com 3+ tickets sem artigo vinculado geram sugestao
    - Sugestao inclui: titulo proposto, categoria L1 sugerida, tickets de referencia
    - Lista de sugestoes visivel no dashboard de analytics com acao "Criar artigo"
  - **Esforco:** L
  - **Dependencias:** TASK-023, TASK-025

---

## Resumo de Esforco

| Fase | Tasks | S | M | L | Sprints |
|------|-------|---|---|---|---------|
| Fase 1 — Fundacao | 11 | 5 | 4 | 1 | 2 |
| Fase 2 — Unificacao | 6 | 1 | 3 | 2 | 2 |
| Fase 3 — Diferenciacao | 6 | 0 | 4 | 2 | 2 |
| Fase 4 — Escala | 4 | 0 | 2 | 2 | 1+ |
| **Total** | **27** | **6** | **13** | **7** | **7+** |

**Legenda de esforco:** S = 1-2 dias | M = 3-5 dias | L = 5-10 dias

---

## Grafo de Dependencias (simplificado)

```
TASK-001 → TASK-002 → TASK-008
                    ↘ TASK-012 → TASK-013 → TASK-023
                    ↘ TASK-018

TASK-004 → TASK-006 → TASK-008 → TASK-015 → TASK-016

TASK-005 → TASK-017 → TASK-019
                    ↘ TASK-022

TASK-007 → TASK-025

TASK-011 → TASK-014 → TASK-021
                    ↘ TASK-024 → TASK-026
                    ↘ TASK-023 → TASK-027

TASK-003 → TASK-026

Independentes: TASK-009, TASK-010, TASK-020
```

---

*Gerado em 2026-03-30 pelo helpdesk-dev-squad | Fonte: KB Report v1 — Support Knowledge Squad*
