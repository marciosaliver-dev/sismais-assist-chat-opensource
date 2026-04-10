# Spec: KB Phase 1 — Fundacao (Sprint 1-2)

**Data:** 2026-03-30
**Origem:** [KB Report v1](../../agentes_sismais/squads/@thuliobittencourt/support-knowledge-squad/output/v1/step-06-kb-report.md)
**Escopo:** Taxonomia 7 L1 no banco, templates de artigo, fix do RAG sync, publicacao dos 32 artigos iniciais, quick wins

---

## 1. Taxonomia — Setup no Banco de Dados

### Contexto

A tabela `knowledge_products` ja existe (migration `20260305120000`) com 2 registros seed (Mais Simples, MaxPro). A tabela `knowledge_groups` tambem existe. Precisamos inserir as 7 categorias L1 como products e seus L2s como groups.

### Decisao de modelagem

- **L1 = `knowledge_products`** (7 categorias)
- **L2 = `knowledge_groups`** (31 subcategorias vinculadas ao product_id)
- Artigos (`ai_knowledge_base`) vinculam-se via `product_id` (L1) e `group_id` (L2)

### Migration: `20260401120000_kb_taxonomy_7l1.sql`

**Arquivo:** `supabase/migrations/20260401120000_kb_taxonomy_7l1.sql`

```sql
-- ============================================================
-- Migration: Taxonomia KB — 7 categorias L1 + subcategorias L2
-- Ref: KB Report v1 — step-06-kb-report.md, secao 4
-- ============================================================

-- 1. Inserir 7 categorias L1 como knowledge_products
INSERT INTO knowledge_products (name, slug, description, icon, color, sort_order, is_active) VALUES
  ('Primeiros Passos',             'primeiros-passos',   'Cadastro, login, aprovacao e primeiros passos na plataforma',   'RocketLaunch',   '#10b981', 10, true),
  ('Atendimento & Tickets',        'atendimento',        'Dashboard, inbox, kanban, avaliacoes e macros',                 'Headset',         '#3b82f6', 20, true),
  ('Agentes IA & Automacoes',      'agentes-ia',         'Criacao de agentes, AI Builder, copilot, flows e campanhas',    'Bot',             '#8b5cf6', 30, true),
  ('Base de Conhecimento & Manuais','base-conhecimento', 'Documentos, artigos, manuais e help center publico',           'BookOpen',        '#f59e0b', 40, true),
  ('WhatsApp & Canais',            'whatsapp-canais',    'Instancias WhatsApp, mensagens, contatos e Instagram DM',       'MessageCircle',   '#22c55e', 50, true),
  ('CRM & Clientes',               'crm-clientes',       'Lista de clientes, Customer 360, sincronizacao GL',            'Users',           '#ec4899', 60, true),
  ('Configuracoes & Sistema',      'configuracoes',      'Configuracoes gerais, equipe, relatorios, integracoes',         'Settings',        '#64748b', 70, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- 2. Inserir subcategorias L2 como knowledge_groups
-- Usamos subqueries para resolver o product_id pelo slug

-- L1: Primeiros Passos (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Cadastro & Login',     'Criar conta, fazer login, recuperar senha',       'LogIn',        1),
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Aprovacao de Acesso',  'Fluxo de aprovacao e ativacao da conta',          'ShieldCheck',  2),
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Tour Inicial',         'Guia de primeiros passos apos ativacao',          'Map',          3),
  ((SELECT id FROM knowledge_products WHERE slug = 'primeiros-passos'), 'Planos & Creditos',    'Planos disponiveis, creditos IA, faturamento',    'CreditCard',   4);

-- L1: Atendimento & Tickets (5 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Dashboard',            'Visao geral de metricas e KPIs',                  'LayoutDashboard', 1),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Inbox & Fila',         'Caixa de entrada e fila de atendimento',          'Inbox',            2),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Kanban',               'Quadro kanban de tickets',                        'Columns',          3),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Avaliacoes & CSAT',    'Pesquisas de satisfacao e avaliacoes',             'Star',             4),
  ((SELECT id FROM knowledge_products WHERE slug = 'atendimento'), 'Macros',               'Templates de respostas rapidas',                  'Zap',              5);

-- L1: Agentes IA & Automacoes (5 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Criacao de Agentes',      'Criar e configurar agentes IA',                 'UserPlus',      1),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'AI Builder & Skills',     'Construtor visual e skills dos agentes',         'Puzzle',        2),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Supervisao & Copilot',    'Monitorar agentes e modo copiloto',              'Eye',           3),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Automacoes & Flows',      'Automacoes de fluxo e Flow Builder',             'GitBranch',     4),
  ((SELECT id FROM knowledge_products WHERE slug = 'agentes-ia'), 'Campanhas',               'Campanhas de mensagens automatizadas',           'Megaphone',     5);

-- L1: Base de Conhecimento & Manuais (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Documentos & Artigos',  'Upload e gestao de documentos',            'FileText',      1),
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Manuais',               'Manuais do sistema (editor interno)',      'BookOpen',      2),
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Help Center Publico',   'Portal publico de autoatendimento',        'Globe',         3),
  ((SELECT id FROM knowledge_products WHERE slug = 'base-conhecimento'), 'Importacao',            'Importar KB de fontes externas (Zoho, etc)', 'Upload',     4);

-- L1: WhatsApp & Canais (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Instancias WhatsApp',  'Configurar e gerenciar instancias UAZAPI',    'Smartphone',    1),
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Mensagens & Contatos', 'Enviar mensagens e gerenciar contatos',       'MessageSquare', 2),
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Instagram DM',         'Integrar e gerenciar Instagram Direct',       'Instagram',     3),
  ((SELECT id FROM knowledge_products WHERE slug = 'whatsapp-canais'), 'Painel de Teste',      'Testar envio e recebimento de mensagens',     'TestTube',      4);

-- L1: CRM & Clientes (4 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Lista & Cadastro',       'Listar e cadastrar clientes',                 'List',          1),
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Customer 360',           'Visao completa do cliente',                   'CircleUser',    2),
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Sincronizacao GL',       'Sincronizar dados com Sismais GL',            'RefreshCw',     3),
  ((SELECT id FROM knowledge_products WHERE slug = 'crm-clientes'), 'Contatos & Segmentacao', 'Gerenciar contatos e segmentar base',         'Filter',        4);

-- L1: Configuracoes & Sistema (5 L2s)
INSERT INTO knowledge_groups (product_id, name, description, icon, sort_order) VALUES
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Gerais',                'Configuracoes gerais da plataforma',           'Sliders',       1),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Equipe & Permissoes',   'Gerenciar usuarios, papeis e permissoes',     'Shield',        2),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Relatorios',            'Relatorios e exportacoes de dados',           'BarChart3',     3),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Integracoes',           'Integracoes com sistemas externos',           'Plug',          4),
  ((SELECT id FROM knowledge_products WHERE slug = 'configuracoes'), 'Sistema & Atualizacoes','Versoes, changelog e atualizacoes',           'RefreshCcw',    5);

-- 3. Adicionar coluna slug em knowledge_groups para URLs amigaveis
ALTER TABLE knowledge_groups ADD COLUMN IF NOT EXISTS slug TEXT;

-- Popular slugs dos grupos recem-inseridos
UPDATE knowledge_groups SET slug = lower(replace(replace(replace(replace(name, ' & ', '-'), ' ', '-'), '&', ''), '''', ''))
  WHERE slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_groups_slug ON knowledge_groups(slug);
```

### Validacao pos-migration

```sql
-- Deve retornar 7 (ignorando os 2 produtos antigos Mais Simples/MaxPro)
SELECT count(*) FROM knowledge_products WHERE slug IN (
  'primeiros-passos','atendimento','agentes-ia','base-conhecimento',
  'whatsapp-canais','crm-clientes','configuracoes'
);

-- Deve retornar 31
SELECT count(*) FROM knowledge_groups g
JOIN knowledge_products p ON g.product_id = p.id
WHERE p.slug IN (
  'primeiros-passos','atendimento','agentes-ia','base-conhecimento',
  'whatsapp-canais','crm-clientes','configuracoes'
);
```

---

## 2. Templates de Artigo — Metadados no Banco

### Contexto

A coluna `content_type` ja existe como `TEXT` na `ai_knowledge_base` (migration `20260213202505`). A coluna `difficulty_level` ja existe com CHECK constraint (migration `20260307120000`). Precisamos adicionar campos adicionais de metadados para os 6 templates.

### Migration: `20260401120001_kb_article_metadata.sql`

**Arquivo:** `supabase/migrations/20260401120001_kb_article_metadata.sql`

```sql
-- ============================================================
-- Migration: Metadados de artigo KB para 6 templates
-- Ref: KB Report v1 — templates How-To, FAQ, Troubleshooting,
--      Tutorial, Procedimento Interno, Release Notes
-- ============================================================

-- 1. Adicionar campos de metadados para templates
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS estimated_time TEXT,
  ADD COLUMN IF NOT EXISTS audience_tier TEXT CHECK (audience_tier IN ('tier1', 'tier2', 'tier3')),
  ADD COLUMN IF NOT EXISTS rag_chunks BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'draft')),
  ADD COLUMN IF NOT EXISTS article_template TEXT CHECK (article_template IN ('how-to', 'faq', 'troubleshooting', 'tutorial', 'internal-procedure', 'release-notes')),
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- 2. Indices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_kb_article_template ON ai_knowledge_base(article_template) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_audience_tier ON ai_knowledge_base(audience_tier) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_visibility ON ai_knowledge_base(visibility) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_stale_detection ON ai_knowledge_base(last_reviewed_at) WHERE is_active = true;

-- 3. Artigos com rag_chunks = false nao devem gerar embeddings
COMMENT ON COLUMN ai_knowledge_base.rag_chunks IS 'Se false, artigo nao gera embeddings (ex: procedimentos internos)';
COMMENT ON COLUMN ai_knowledge_base.article_template IS 'Template do artigo: how-to, faq, troubleshooting, tutorial, internal-procedure, release-notes';
COMMENT ON COLUMN ai_knowledge_base.visibility IS 'public=visivel para clientes, internal=apenas agentes, draft=rascunho';
```

### Formato de frontmatter dos templates

Cada artigo segue um padrao de metadados armazenado no campo `metadata` (JSONB):

```json
{
  "template": "how-to",
  "id_pattern": "HT-001",
  "difficulty": "iniciante",
  "estimated_time": "5 min",
  "audience_tier": "tier1",
  "plan_required": "todos",
  "screenshots": true,
  "max_steps": 7,
  "related_articles": ["FAQ-PP-01", "TS-001"],
  "synonyms": ["como fazer login", "entrar no sistema", "acessar conta"],
  "last_reviewed": "2026-03-30",
  "version": 1
}
```

**Mapeamento template -> campos obrigatorios no metadata:**

| Template | Campos obrigatorios em `metadata` |
|----------|----------------------------------|
| `how-to` | `id_pattern`, `difficulty`, `estimated_time`, `max_steps`, `screenshots` |
| `faq` | `id_pattern`, resposta curta no inicio do `content` |
| `troubleshooting` | `id_pattern`, `severity`, `affected_component`, `escalation_cta` |
| `tutorial` | `id_pattern`, `video_url` (se disponivel), `checkpoints` |
| `internal-procedure` | `id_pattern`, `criticality`, `approved_by`, `checklist` |
| `release-notes` | `release_date`, `version`, `affected_features` |

---

## 3. RAG Sync Fix — Edge Functions

### 3.1 Tabela `kb_sync_log`

**Arquivo:** `supabase/migrations/20260401120002_kb_sync_log.sql`

```sql
-- ============================================================
-- Migration: Tabela de log do sync RAG
-- Registra cada operacao de sincronizacao de embeddings
-- ============================================================

CREATE TABLE IF NOT EXISTS kb_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES ai_knowledge_base(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('embed_created', 'embed_updated', 'embed_deleted', 'embed_failed', 'stale_detected', 'chunk_created')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'retry')),
  error_message TEXT,
  chunks_processed INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_sync_log_article ON kb_sync_log(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_sync_log_status ON kb_sync_log(status) WHERE status = 'error';
CREATE INDEX IF NOT EXISTS idx_kb_sync_log_created ON kb_sync_log(created_at);

ALTER TABLE kb_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_sync_log_service" ON kb_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "kb_sync_log_read" ON kb_sync_log FOR SELECT TO authenticated USING (true);
```

### 3.2 Fix: `generate-embedding` com retry e logging

**Arquivo a alterar:** `supabase/functions/generate-embedding/index.ts`

**Alteracoes necessarias:**

1. Adicionar funcao `retryWithBackoff(fn, maxRetries=2, baseDelay=1000)`:
   ```typescript
   async function retryWithBackoff<T>(
     fn: () => Promise<T>,
     maxRetries = 2,
     baseDelay = 1000
   ): Promise<T> {
     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         return await fn()
       } catch (err) {
         if (attempt === maxRetries) throw err
         const delay = baseDelay * Math.pow(2, attempt)
         console.log(`[generate-embedding] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
         await new Promise(r => setTimeout(r, delay))
       }
     }
     throw new Error('unreachable')
   }
   ```

2. Envolver a chamada de embedding API com `retryWithBackoff`

3. Apos sucesso ou falha, inserir log em `kb_sync_log`:
   ```typescript
   await supabase.from('kb_sync_log').insert({
     article_id: documentId,
     action: success ? 'embed_created' : 'embed_failed',
     status: success ? 'success' : 'error',
     error_message: errorMsg || null,
     retry_count: retries,
     latency_ms: Date.now() - startTime,
   })
   ```

### 3.3 Fix: `document-processor` — substituir fire-and-forget

**Arquivo a alterar:** `supabase/functions/document-processor/index.ts`

**Problema atual (linhas 285-291 e 312-316):** Embedding e disparado com `.catch()` que apenas loga — nao ha retry nem log persistente.

**Alteracoes necessarias:**

1. Substituir o bloco fire-and-forget por chamada com `await` + retry:
   ```typescript
   // ANTES (fire-and-forget):
   supabase.functions.invoke('generate-embedding', {
     body: { document_id: chunk.id },
   }).catch((err: Error) => {
     log('warn', `Embedding generation failed for chunk ${chunk.id}: ${err.message}`)
   })

   // DEPOIS (com retry e logging):
   async function invokeEmbeddingWithRetry(docId: string, retries = 2): Promise<boolean> {
     for (let attempt = 0; attempt <= retries; attempt++) {
       const { error } = await supabase.functions.invoke('generate-embedding', {
         body: { document_id: docId },
       })
       if (!error) return true
       log('warn', `Embedding attempt ${attempt + 1} failed for ${docId}: ${error.message}`)
       if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
     }
     // Registrar falha no log
     await supabase.from('kb_sync_log').insert({
       article_id: docId,
       action: 'embed_failed',
       status: 'error',
       error_message: 'Max retries exceeded in document-processor',
       retry_count: retries,
     })
     return false
   }
   ```

2. Chamar `invokeEmbeddingWithRetry` para cada chunk (pode ser em paralelo com `Promise.allSettled`)

### 3.4 Fix: `extract-conversation-knowledge` — threshold 0.85 -> 0.70

**Arquivo a alterar:** `supabase/functions/extract-conversation-knowledge/index.ts`

**Problema atual (linhas 66-77):** O learning loop so extrai conhecimento de conversas com confidence media >= 0.85, o que descarta ~60% das conversas potencialmente uteis.

**Alteracao:**

```typescript
// ANTES (linha 72):
if (avgConfidence < 0.85) {

// DEPOIS:
const LEARNING_THRESHOLD = 0.70
if (avgConfidence < LEARNING_THRESHOLD) {
```

### 3.5 Habilitar `FF_RAG_SEMANTIC_CHUNKING`

**Arquivo de referencia:** `supabase/functions/_shared/feature-flags.ts` (linha 97)

**Acao:** Configurar a variavel de ambiente `FF_RAG_SEMANTIC_CHUNKING=true` no Supabase Dashboard > Edge Functions > Secrets.

A flag ja e lida em `supabase/functions/knowledge-ingestion/index.ts` (linha 214) e ativa o chunking semantico por secao (H2/H3). Nao requer alteracao de codigo — apenas setar o env var.

### 3.6 Trigger automatico de re-embedding on publish/update

**Contexto:** Ja existe um trigger `trg_knowledge_re_embed` (migration `20260307120000`, linhas 55-67) que faz `NEW.embedding = NULL` quando o conteudo muda. Porem, isso so anula o embedding — nao dispara re-geracao.

**Solucao:** Criar um database webhook (pg_net) ou uma cron function que detecta artigos com `embedding IS NULL AND is_active = true AND rag_chunks = true` e dispara `generate-embedding`.

**Migration:** `supabase/migrations/20260401120003_kb_auto_reembed.sql`

```sql
-- ============================================================
-- Funcao que detecta artigos sem embedding e enfileira re-geracao
-- Executar via pg_cron a cada 5 minutos ou via edge function cron
-- ============================================================

CREATE OR REPLACE FUNCTION detect_missing_embeddings()
RETURNS TABLE (article_id UUID, title TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT kb.id, kb.title
  FROM ai_knowledge_base kb
  WHERE kb.is_active = true
    AND kb.embedding IS NULL
    AND COALESCE(kb.rag_chunks, true) = true
    AND kb.content IS NOT NULL
    AND length(kb.content) > 50
  ORDER BY kb.updated_at DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Edge function cron (alternativa):** Criar `supabase/functions/kb-reembed-cron/index.ts` que:
1. Chama `detect_missing_embeddings()`
2. Para cada artigo retornado, invoca `generate-embedding`
3. Loga resultado em `kb_sync_log`
4. Configurar no `config.toml` como cron a cada 5 minutos

---

## 4. Publicacao dos 32 Artigos Iniciais

### Contexto

Os 32 artigos estao documentados em `agentes_sismais/squads/@thuliobittencourt/support-knowledge-squad/output/v1/step-05-content-library.md`. Precisamos de um script para inseri-los no banco.

### Script: `scripts/seed-kb-articles.ts`

**Arquivo:** `scripts/seed-kb-articles.ts` (executar via `npx tsx scripts/seed-kb-articles.ts`)

**Estrutura do script:**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ArticleSeed {
  title: string
  content: string
  article_template: 'how-to' | 'faq' | 'troubleshooting' | 'tutorial' | 'internal-procedure'
  l1_slug: string        // slug do knowledge_product
  l2_name: string        // nome do knowledge_group
  tags: string[]
  difficulty_level: 'iniciante' | 'intermediario' | 'avancado'
  audience_tier: 'tier1' | 'tier2'
  visibility: 'public' | 'internal'
  rag_chunks: boolean
  estimated_time: string
  metadata: Record<string, unknown>
}

const articles: ArticleSeed[] = [
  // ── HOW-TO (5) ──
  {
    title: 'Como fazer login e acessar a plataforma',
    content: '...', // Copiar de step-05-content-library.md
    article_template: 'how-to',
    l1_slug: 'primeiros-passos',
    l2_name: 'Cadastro & Login',
    tags: ['login', 'acesso', 'senha'],
    difficulty_level: 'iniciante',
    audience_tier: 'tier1',
    visibility: 'public',
    rag_chunks: true,
    estimated_time: '3 min',
    metadata: { id_pattern: 'HT-001', max_steps: 5, screenshots: true },
  },
  // ... (demais 31 artigos seguindo o mesmo padrao)
]

async function seed() {
  // 1. Buscar mapa de slugs -> product_id
  const { data: products } = await supabase
    .from('knowledge_products')
    .select('id, slug')

  const productMap = new Map(products?.map(p => [p.slug, p.id]))

  // 2. Buscar mapa de groups
  const { data: groups } = await supabase
    .from('knowledge_groups')
    .select('id, name, product_id')

  // 3. Inserir artigos
  for (const article of articles) {
    const productId = productMap.get(article.l1_slug)
    const group = groups?.find(g =>
      g.product_id === productId && g.name === article.l2_name
    )

    const { data, error } = await supabase
      .from('ai_knowledge_base')
      .insert({
        title: article.title,
        content: article.content,
        content_type: article.article_template,
        article_template: article.article_template,
        product_id: productId,
        group_id: group?.id,
        tags: article.tags,
        difficulty_level: article.difficulty_level,
        audience_tier: article.audience_tier,
        visibility: article.visibility,
        rag_chunks: article.rag_chunks,
        estimated_time: article.estimated_time,
        metadata: article.metadata,
        is_active: true,
        is_public: article.visibility === 'public',
        feeds_ai: article.rag_chunks,
        source: 'kb_seed_v1',
      })
      .select('id')
      .single()

    if (error) {
      console.error(`ERRO ao inserir "${article.title}":`, error.message)
      continue
    }

    console.log(`OK: ${article.title} -> ${data.id}`)

    // 4. Disparar embedding (artigos com rag_chunks=true)
    if (article.rag_chunks) {
      await supabase.functions.invoke('generate-embedding', {
        body: { document_id: data.id },
      })
    }
  }

  // 5. Verificar
  const { count } = await supabase
    .from('ai_knowledge_base')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'kb_seed_v1')

  console.log(`\nTotal inseridos: ${count}/32`)
}

seed().catch(console.error)
```

### Distribuicao dos 32 artigos por L1/L2

| L1 | Template | Qtd | Artigos |
|----|----------|-----|---------|
| Primeiros Passos | How-To | 1 | HT-001: Login e acesso |
| Primeiros Passos | FAQ | 4 | FAQ-PP-01 a FAQ-PP-04 |
| Atendimento | How-To | 1 | HT-005: Kanban |
| Atendimento | FAQ | 4 | FAQ-AT-01 a FAQ-AT-04 |
| Agentes IA | How-To | 1 | HT-003: Configurar agente IA |
| Agentes IA | FAQ | 4 | FAQ-IA-01 a FAQ-IA-04 |
| Agentes IA | Troubleshooting | 1 | TS-001: IA nao responde |
| Base de Conhecimento | How-To | 1 | HT-004: Criar artigo KB |
| Base de Conhecimento | FAQ | 4 | FAQ-KB-01 a FAQ-KB-04 |
| WhatsApp & Canais | How-To | 1 | HT-002: Conectar WhatsApp |
| WhatsApp & Canais | FAQ | 2 | FAQ-WA-01, FAQ-WA-02 |
| WhatsApp & Canais | Troubleshooting | 1 | TS-002: WhatsApp nao conecta |
| CRM & Clientes | Troubleshooting | 1 | TS-003: Sincronizacao GL falha |
| Configuracoes | FAQ | 2 | FAQ-CF-01, FAQ-CF-02 |
| Cross-L1 | Tutorial | 2 | TUT-001: Primeiro atendimento, TUT-002: Flow Builder |
| Cross-L1 | Procedimento Interno | 2 | PROC-001: Escalacao, PROC-002: KCS Loop |

### Verificacao pos-seed

```sql
-- Verificar distribuicao
SELECT p.name AS l1, g.name AS l2, count(kb.id) AS artigos
FROM ai_knowledge_base kb
JOIN knowledge_products p ON kb.product_id = p.id
LEFT JOIN knowledge_groups g ON kb.group_id = g.id
WHERE kb.source = 'kb_seed_v1'
GROUP BY p.name, g.name
ORDER BY p.sort_order, g.sort_order;

-- Verificar embeddings gerados (deve ser 30 — excluindo 2 procedimentos internos)
SELECT count(*) FROM ai_knowledge_base
WHERE source = 'kb_seed_v1' AND embedding IS NOT NULL;

-- Teste de busca RAG
SELECT title, (1 - (embedding <=> query_embedding))::float AS score
FROM ai_knowledge_base
WHERE is_active = true AND embedding IS NOT NULL
ORDER BY embedding <=> (
  -- embedding de teste para "como fazer login"
  SELECT embedding FROM ai_knowledge_base WHERE title ILIKE '%login%' LIMIT 1
)
LIMIT 5;
```

---

## 5. Quick Wins (Sprint 1)

### 5.1 "Last updated" visivel nos artigos

**Arquivos a alterar:**
- `src/pages/ManualArticleViewer.tsx`
- `src/pages/HelpManualViewer.tsx`
- `src/pages/HelpContentViewer.tsx`

**Alteracao:** Adicionar `<p>` com a data `updated_at` formatada logo abaixo do titulo do artigo:

```tsx
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Dentro do componente, apos o titulo:
{article.updated_at && (
  <p className="text-sm text-muted-foreground mt-1">
    Atualizado {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true, locale: ptBR })}
  </p>
)}
```

### 5.2 Componente "Foi util?" (feedback)

**Contexto:** O hook `useManualFeedback` em `src/hooks/useManualArticles.ts` (linhas 112-142) ja implementa a mutation para `helpful_count` e `not_helpful_count`. As colunas serao criadas na migration `20260401120001`.

**Arquivos a alterar:**
- `src/pages/ManualArticleViewer.tsx` — adicionar componente de feedback
- `src/pages/HelpManualViewer.tsx` — idem
- `src/pages/HelpContentViewer.tsx` — idem

**Componente a criar:** `src/components/knowledge/ArticleFeedback.tsx`

```tsx
import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useManualFeedback } from '@/hooks/useManualArticles'
import { toast } from 'sonner'

interface ArticleFeedbackProps {
  articleId: string
}

export function ArticleFeedback({ articleId }: ArticleFeedbackProps) {
  const [submitted, setSubmitted] = useState(false)
  const feedback = useManualFeedback()

  const handleFeedback = (helpful: boolean) => {
    feedback.mutate({ id: articleId, helpful }, {
      onSuccess: () => {
        setSubmitted(true)
        toast.success('Obrigado pelo feedback!')
      },
    })
  }

  if (submitted) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Obrigado pelo seu feedback!
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 justify-center py-4 border-t mt-6">
      <span className="text-sm text-muted-foreground">Este artigo foi util?</span>
      <Button variant="outline" size="sm" onClick={() => handleFeedback(true)}>
        <ThumbsUp className="h-4 w-4 mr-1" /> Sim
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleFeedback(false)}>
        <ThumbsDown className="h-4 w-4 mr-1" /> Nao
      </Button>
    </div>
  )
}
```

**Uso nos viewers:** Adicionar `<ArticleFeedback articleId={article.id} />` no final do conteudo de cada viewer.

### 5.3 Fix: MANUAL_PRODUCT_ID hardcoded

**Arquivo:** `src/hooks/useManualArticles.ts` (linhas 20 e 41)

**Problema:** O UUID `d09f2e03-141b-44c1-acaa-cda3a49fbfc2` esta hardcoded em 2 lugares. Se o produto for recriado (nova migration), o ID muda e o hook quebra.

**Solucao:** Buscar o product_id pelo slug em vez de hardcodar o UUID.

```typescript
// ANTES (linhas 20-24):
const MANUAL_PRODUCT_ID = 'd09f2e03-141b-44c1-acaa-cda3a49fbfc2'
const { data, error } = await supabase
  .from('knowledge_groups')
  .select('*')
  .eq('product_id', MANUAL_PRODUCT_ID)

// DEPOIS:
// Receber productSlug como parametro do hook (default: 'mais-simples')
const { data: product } = await supabase
  .from('knowledge_products')
  .select('id')
  .eq('slug', productSlug)
  .single()

if (!product) return []

const { data, error } = await supabase
  .from('knowledge_groups')
  .select('*')
  .eq('product_id', product.id)
```

**Assinatura atualizada do hook:**

```typescript
interface UseManualArticlesParams {
  productSlug?: string   // slug do knowledge_product (default: 'mais-simples')
  groupId?: string       // antes era "productId" — renomear para clareza
  search?: string
}
```

**Arquivos que usam o hook (verificar e atualizar chamadas):**
- `src/pages/HelpManualViewer.tsx`
- `src/pages/ManualHome.tsx`
- `src/pages/ManualArticleViewer.tsx`

---

## 6. Ordem de Execucao

### Sprint 1 (semana 1-2)

| # | Tarefa | Tipo | Esforco | Dependencia |
|---|--------|------|---------|-------------|
| 1 | Migration taxonomia 7 L1 + 31 L2s | DB | 1h | — |
| 2 | Migration metadados de artigo | DB | 30min | — |
| 3 | Migration `kb_sync_log` | DB | 30min | — |
| 4 | Migration `detect_missing_embeddings` | DB | 30min | #3 |
| 5 | Fix MANUAL_PRODUCT_ID hardcoded | Frontend | 1h | #1 |
| 6 | Componente ArticleFeedback | Frontend | 2h | #2 |
| 7 | "Last updated" nos viewers | Frontend | 1h | — |
| 8 | Fix `extract-conversation-knowledge` threshold | Edge Fn | 30min | — |
| 9 | Setar `FF_RAG_SEMANTIC_CHUNKING=true` | Config | 15min | — |

### Sprint 2 (semana 3-4)

| # | Tarefa | Tipo | Esforco | Dependencia |
|---|--------|------|---------|-------------|
| 10 | Retry + logging no `generate-embedding` | Edge Fn | 3h | #3 |
| 11 | Fix fire-and-forget no `document-processor` | Edge Fn | 2h | #10 |
| 12 | Criar `kb-reembed-cron` | Edge Fn | 2h | #4, #10 |
| 13 | Script seed dos 32 artigos | Script | 4h | #1, #2 |
| 14 | Executar seed + validar embeddings | Ops | 2h | #13, #10 |
| 15 | Teste E2E: busca RAG retorna artigos corretos | QA | 2h | #14 |

**Esforco total estimado:** ~20h de desenvolvimento

---

## 7. Criterios de Aceite (Definition of Done)

- [ ] 7 knowledge_products com slugs corretos no banco
- [ ] 31 knowledge_groups vinculados corretamente aos products
- [ ] Colunas `article_template`, `audience_tier`, `rag_chunks`, `visibility`, `helpful_count`, `not_helpful_count`, `view_count`, `last_reviewed_at` existem na `ai_knowledge_base`
- [ ] Tabela `kb_sync_log` existe e recebe logs de embedding
- [ ] `generate-embedding` faz 2 retries com backoff exponencial
- [ ] `document-processor` nao usa fire-and-forget — aguarda resultado e loga
- [ ] `extract-conversation-knowledge` usa threshold 0.70
- [ ] `FF_RAG_SEMANTIC_CHUNKING=true` configurado
- [ ] 32 artigos inseridos com `product_id` e `group_id` corretos
- [ ] >= 30 artigos com embedding gerado (exceto procedimentos internos)
- [ ] Busca RAG por "como fazer login" retorna HT-001 como primeiro resultado
- [ ] Busca RAG por "creditos ia" retorna FAQ-IA-02 nos top 3
- [ ] `useManualArticles` busca por slug em vez de UUID hardcoded
- [ ] "Atualizado ha X dias" visivel em todos os article viewers
- [ ] Componente "Foi util?" funcional em todos os article viewers

---

## 8. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migration de seed falha por conflito de slug | Medio | Usar `ON CONFLICT DO UPDATE` |
| Embeddings nao geram para os 32 artigos | Alto | Cron `kb-reembed-cron` detecta e re-tenta |
| Threshold 0.70 gera conhecimento de baixa qualidade | Medio | Monitorar `kb_sync_log` na primeira semana, ajustar se necessario |
| `FF_RAG_SEMANTIC_CHUNKING` quebra artigos existentes | Baixo | Flag so afeta novos ingestoes; artigos existentes mantem chunks atuais |
| MANUAL_PRODUCT_ID usado em outros pontos nao mapeados | Medio | Grep no codebase por `d09f2e03` antes de remover |

---

*Spec gerada em 2026-03-30 — Support Knowledge Squad / KB Phase 1*
