# E06 — Relatorio RAG/Knowledge Base
## Sismais Helpdesk IA — Otimizacao do Pipeline de Busca Semantica

**Data:** 2026-03-19
**Autor:** Engenheiro RAG/Knowledge (analise automatizada)
**Branch:** claude/sismais-support-system-JCMCi

---

## 1. DIAGNOSTICO DO ESTADO ATUAL

### 1.1 Modelo de Embeddings
- **Modelo atual:** `openai/text-embedding-3-small` (1536 dimensoes)
- **Via:** OpenRouter (nao direto OpenAI)
- **Custo:** ~$0.02/1M tokens
- **Qualidade:** Boa para portugues, suficiente para o volume atual

**Avaliacao:** O modelo text-embedding-3-small e adequado para o caso de uso. O text-embedding-3-large (3072 dims) ofereceria ~2% de melhoria em MTEB benchmarks mas dobraria custo e exigiria migration da coluna vector(1536) -> vector(3072). **Nao recomendado migrar agora.**

### 1.2 Estrategia de Chunking (ANTES)
- **Tipo:** Fixo por caracteres
- **Tamanho:** 2000 chars com 200 chars overlap
- **Threshold:** Apenas docs > 6000 chars sao divididos
- **Problema:** Corta no meio de frases/paragrafos, gerando chunks sem coerencia semantica
- **Problema:** Overlap de 200 chars (10%) e insuficiente para manter contexto entre chunks

### 1.3 Pipeline de Busca (ANTES)
- **`rag-search`**: Tentava chamar `search_knowledge_hybrid` que **NAO EXISTIA** no banco. Falha silenciosa.
- **`agent-executor`**: Usava `search_knowledge` (vector-only). Funcionava mas sem full-text.
- **`semantic-search`**: Funcao separada, usava `search_knowledge` corretamente. Threshold mais baixo (0.5).
- **Contexto no prompt:** Truncava conteudo RAG a **800 chars** — perda significativa de informacao.

### 1.4 Problemas Criticos Encontrados

| # | Problema | Impacto | Severidade |
|---|---------|---------|------------|
| R1 | `rag-search` chama RPC inexistente `search_knowledge_hybrid` | Busca RAG via rag-search falha 100% | CRITICO |
| R2 | Chunking fixo corta frases no meio | Embeddings de baixa qualidade | ALTO |
| R3 | Contexto RAG truncado a 800 chars | LLM perde informacao relevante | ALTO |
| R4 | Modelo de embedding hardcoded em knowledge-ingestion | Impossivel trocar modelo via config | MEDIO |
| R5 | Sem re-ranking | Documentos menos relevantes podem aparecer primeiro | MEDIO |
| R6 | Sem metricas de qualidade de retrieval | Impossivel medir se RAG ajuda | MEDIO |
| R7 | Sem deteccao de conteudo desatualizado | Docs antigos poluem respostas | BAIXO |

---

## 2. OTIMIZACOES IMPLEMENTADAS

### 2.1 Busca Hibrida (Vector + Full-Text com RRF)
**Arquivo:** `supabase/migrations/20260319120000_rag_improvements.sql`

- Criada coluna `fts_vector` (tsvector) com trigger automatico
- Indice GIN para busca full-text em portugues
- Nova funcao SQL `search_knowledge_hybrid` usando **Reciprocal Rank Fusion (RRF)**:
  - Peso vector: 60% | Peso full-text: 40%
  - Threshold relaxado em 20% para vector (permite fusion resgatar docs com match textual forte)
  - Constante RRF k=60 (padrao da literatura)
- **Feature flag:** `FF_RAG_HYBRID_SEARCH` (default: off)

### 2.2 Re-ranking via LLM
**Arquivo:** `supabase/functions/rag-search/index.ts`

- Apos busca (hibrida ou vector), LLM leve (Gemini Flash Lite) reordena resultados
- Custo adicional: ~$0.001 por query (desprezivel)
- Latencia adicional: ~300-500ms
- **Feature flag:** `FF_RAG_RERANK` (default: off)

### 2.3 Chunking Semantico
**Arquivo:** `supabase/functions/knowledge-ingestion/index.ts`

- Separacao por hierarquia: headers markdown > horizontal rules > paragrafos triplos > paragrafos duplos
- Target: 1500 chars por chunk (range 200-2500)
- Overlap semantico: ultimo paragrafo do chunk anterior e mantido como "ponte"
- Merge de chunks pequenos (<200 chars) com o proximo
- **Feature flag:** `FF_RAG_SEMANTIC_CHUNKING` (default: off)

### 2.4 Modelo de Embedding Dinamico
**Arquivo:** `supabase/functions/knowledge-ingestion/index.ts`

- Removido hardcode `openai/text-embedding-3-small`
- Agora le de `platform_ai_config` via `getModelConfig(supabase, 'embedding', fallback)`
- Permite trocar modelo sem redeploy

### 2.5 Contexto RAG Ampliado
**Arquivo:** `supabase/functions/agent-executor/index.ts`

- Conteudo RAG no prompt: **800 -> 1500 chars** por documento
- Adicionado score de relevancia no cabecalho de cada fonte
- Agent-executor agora suporta busca hibrida (gated por flag)

### 2.6 Metricas de Qualidade de Retrieval
**Arquivos:** Migration SQL + `agent-executor/index.ts`

- Tabela `ai_knowledge_ratings`: registra rating (-1/0/1) por documento usado
- Coluna `retrieval_count` em `ai_knowledge_base`: quantas vezes cada doc foi usado
- Coluna `avg_usefulness`: media de ratings
- Rating automatico baseado no confidence score da resposta
- **Feature flag:** `FF_RAG_QUALITY_TRACKING` (default: off)

### 2.7 Deteccao de Conteudo Desatualizado
**Arquivo:** Migration SQL

- Coluna `last_verified_at` para tracking manual de verificacao
- Coluna `staleness_score` para scoring automatico
- View `knowledge_stale_docs` que classifica documentos em:
  - `never_verified`: nunca verificado, >60 dias
  - `stale`: nao verificado ha >90 dias
  - `low_usefulness`: avg_usefulness < 0.3 com >5 retrievals
  - `ok`: documento saudavel

### 2.8 Feature Flags Adicionadas

| Flag | Env Var | Default | Descricao |
|------|---------|---------|-----------|
| `RAG_HYBRID_SEARCH` | `FF_RAG_HYBRID_SEARCH` | `false` | Busca hibrida vector+full-text |
| `RAG_RERANK` | `FF_RAG_RERANK` | `false` | Re-ranking LLM dos resultados |
| `RAG_SEMANTIC_CHUNKING` | `FF_RAG_SEMANTIC_CHUNKING` | `false` | Chunking por paragrafos/secoes |
| `RAG_QUALITY_TRACKING` | `FF_RAG_QUALITY_TRACKING` | `false` | Rating automatico de docs RAG |

---

## 3. METRICAS DE QUALIDADE (Framework)

### 3.1 Metricas Disponiveis Apos Ativacao

| Metrica | Como Medir | Tabela |
|---------|-----------|--------|
| **Precision@K** | % de docs com rating >= 0 nos top K | `ai_knowledge_ratings` |
| **Recall** | Docs uteis / total de docs relevantes no corpus | Requer dataset de teste |
| **MRR (Mean Reciprocal Rank)** | 1/posicao do primeiro doc relevante | `ai_knowledge_ratings` + posicao |
| **Retrieval Rate** | % de queries que retornam >= 1 doc | Logs do agent-executor |
| **Staleness Rate** | % de docs classificados como stale | `knowledge_stale_docs` view |
| **Avg Usefulness** | Media de ratings por documento | `ai_knowledge_base.avg_usefulness` |

### 3.2 Query SQL para Monitoramento

```sql
-- Precision: % de retrievals uteis (rating >= 0)
SELECT
  COUNT(*) FILTER (WHERE rating >= 0)::float / NULLIF(COUNT(*), 0) AS precision,
  COUNT(*) AS total_ratings,
  AVG(similarity_score) AS avg_similarity
FROM ai_knowledge_ratings
WHERE created_at > now() - interval '7 days';

-- Documentos mais usados e sua utilidade
SELECT
  kb.title,
  kb.retrieval_count,
  kb.avg_usefulness,
  COUNT(r.id) AS ratings_count
FROM ai_knowledge_base kb
LEFT JOIN ai_knowledge_ratings r ON r.knowledge_id = kb.id
WHERE kb.is_active = true
GROUP BY kb.id
ORDER BY kb.retrieval_count DESC
LIMIT 20;

-- Documentos stale que precisam de atencao
SELECT * FROM knowledge_stale_docs
WHERE staleness_status != 'ok'
ORDER BY days_since_verified DESC;
```

---

## 4. ESTRATEGIA DE ATUALIZACAO DE CONTEUDO

### 4.1 Pipeline Automatico
1. **Ingestao com dedup:** knowledge-ingestion ja verifica duplicatas por URL
2. **Re-embedding:** Trigger SQL limpa embedding quando content muda (ja existe)
3. **Extraction:** extract-conversation-knowledge extrai Q&A de conversas bem-sucedidas
4. **Staleness view:** Dashobard pode consumir `knowledge_stale_docs` para alertar admins

### 4.2 Pipeline Manual Recomendado (Futuro)
1. Dashboard de health da knowledge base (consumir view `knowledge_stale_docs`)
2. Botao "Verificar" que atualiza `last_verified_at`
3. Alerta semanal para docs com `staleness_status != 'ok'`
4. Re-crawl automatico de docs com `source = 'firecrawl'` e `staleness_status = 'stale'`

---

## 5. RECOMENDACOES FUTURAS

### Curto Prazo (apos validacao das flags)
1. **Ativar `FF_RAG_HYBRID_SEARCH`** — maior ganho de qualidade, sem risco
2. **Ativar `FF_RAG_QUALITY_TRACKING`** — coletar dados para baseline de metricas
3. **Ativar `FF_RAG_SEMANTIC_CHUNKING`** — re-ingestar docs existentes com novo chunking

### Medio Prazo
4. **Ativar `FF_RAG_RERANK`** — apos ter baseline de metricas para comparar
5. **Criar dashboard de RAG health** — consumir views e tabelas criadas
6. **Re-crawl automatico** — para docs de URL com staleness detectada

### Longo Prazo
7. **Avaliar text-embedding-3-large** — se volume justificar e precision platejar
8. **Contextual embeddings** — adicionar metadata (produto, categoria) ao texto antes de embeddar
9. **Multi-vector retrieval** — embeddings separados para titulo e conteudo

---

## 6. ARQUIVOS MODIFICADOS

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `supabase/migrations/20260319120000_rag_improvements.sql` | Novo | Hybrid search, ratings, staleness |
| `supabase/functions/_shared/feature-flags.ts` | Editado | 4 novas flags RAG |
| `supabase/functions/rag-search/index.ts` | Reescrito | Hybrid search + re-ranking |
| `supabase/functions/knowledge-ingestion/index.ts` | Editado | Semantic chunking + modelo dinamico |
| `supabase/functions/agent-executor/index.ts` | Editado | Hybrid search + contexto 1500 + quality tracking |
| `docs/reports/E06-rag-report.md` | Novo | Este relatorio |

---

## 7. SEQUENCIA DE ATIVACAO RECOMENDADA

```
Dia 1:  Aplicar migration 20260319120000_rag_improvements.sql
Dia 1:  Ativar FF_RAG_QUALITY_TRACKING=true (coletar baseline)
Dia 3:  Ativar FF_RAG_HYBRID_SEARCH=true (melhorar busca)
Dia 7:  Analisar metricas de precision e retrieval rate
Dia 7:  Ativar FF_RAG_SEMANTIC_CHUNKING=true + re-ingestar docs
Dia 14: Ativar FF_RAG_RERANK=true (comparar com baseline)
Dia 21: Avaliar resultados e ajustar pesos/thresholds
```
