# Agent Wizard Redesign + Company Knowledge Central

**Data:** 2026-04-03
**Status:** Aprovado

---

## Resumo

Redesign do modal de edição de agentes IA para um wizard de 9 steps com 3 painéis (sidebar + form + chat copiloto), e criação de uma página central de Conhecimento da Empresa (`/company-knowledge`) para ingestão de dados via PDFs, imagens, scraping de sites/redes sociais e integração com Confluence/Zoho.

---

## Parte 1 — Wizard de Agentes (Redesign do Modal)

### Layout: 3 Painéis

```
┌──────────────┬────────────────────────────┬──────────────────────┐
│  SIDEBAR     │  FORM (step ativo)         │  COPILOTO IA         │
│  220px       │  flex-1                    │  320px               │
│              │                            │                      │
│  ① Perfil    │  Campos editáveis do       │  ┌─ Preview Card ──┐ │
│  ② Comporta. │  step atual                │  │ Nome: Atena     │ │
│  ③ Modelo    │                            │  │ Modelo: Gemini  │ │
│  ④ RAG       │                            │  │ RAG: ✅ 5 docs  │ │
│  ⑤ Skills    │                            │  │ Skills: 3/12    │ │
│  ⑥ Conhec.   │                            │  │ Status: 6/9 ✓   │ │
│  ⑦ Políticas │                            │  └─────────────────┘ │
│  ⑧ Guardrails│                            │                      │
│  ⑨ Q&A       │                            │  💬 Chat messages    │
│              │                            │  ...                 │
│              │                            │  [input + enviar]    │
├──────────────┴────────────────────────────┴──────────────────────┤
│  [Cancelar]                    [Anterior] [Próximo] [Salvar]     │
└──────────────────────────────────────────────────────────────────┘
```

### 9 Steps do Wizard

| # | Step | Componente | Conteúdo |
|---|------|-----------|----------|
| 1 | Perfil | `AgentBasicInfo` + `AgentChannels` | Nome, especialidade, canais, cor, prioridade |
| 2 | Comportamento | `AgentBehavior` | System prompt, tom, saudação, respostas padrão, escalação |
| 3 | Modelo e Parâmetros | `AgentLLMConfig` | Provider, modelo, temperatura, max_tokens |
| 4 | RAG e Base de Conhecimento | `AgentRAGConfig` | Toggle, top_k, threshold, filtros |
| 5 | Skills & Ferramentas | `AgentSkills` + `AgentTools` | Habilidades + function calling |
| 6 | Conhecimento da Empresa | `AgentKnowledgeSelector` (NOVO) | Seletor de fontes da central |
| 7 | Políticas e Restrições | `AgentPolicies` | Horário, SLA, garantia, reembolso |
| 8 | Guardrails | `AgentGuardrails` | Thresholds de confiança, regras de segurança |
| 9 | Treinamento Q&A | `AgentQATraining` | Pares pergunta/resposta para fine-tuning |

### Sidebar — Comportamento

- Cada step mostra ícone + label + indicador de status (checkmark se preenchido, dot se vazio)
- Step ativo: fundo highlight com borda esquerda cyan
- Clique em qualquer step navega direto (não obriga sequência)
- Steps com campos obrigatórios não preenchidos mostram badge de atenção

### Painel Central — Form

- Campos editáveis normais (como hoje)
- Cada campo pode ter botão de AI helper (gerar via chat)
- Reutiliza componentes existentes sem alteração interna

### Painel Direito — Copiloto IA + Preview

#### Preview Card (colapsável, acima do chat)

- Card resumo do agente que atualiza em tempo real conforme o form muda
- Campos mostrados:
  - **Nome** + specialty badge
  - **Modelo** + temperatura
  - **RAG**: habilitado/desabilitado + qty docs
  - **Skills**: X habilitadas / Y total
  - **Progresso**: X/9 steps configurados
  - **Canais**: ícones dos canais ativos
- Toggle colapsar/expandir (padrão: expandido)
- Clique em qualquer item do preview navega para o step correspondente

#### Chat Copiloto

- Mantém comportamento atual do `AgentAssistantTab`
- Sempre visível em todos os steps (não é mais uma aba separada)
- Sugestões de prompt contextuais ao step ativo:
  - Step 1 (Perfil): "Sugerir nome", "Definir especialidade"
  - Step 2 (Comportamento): "Melhorar prompt", "Gerar saudação"
  - Step 3 (Modelo): "Recomendar modelo para meu caso"
  - etc.
- Mudanças sugeridas pelo chat aparecem como diff no chat e aplicam ao form ao clicar "Aplicar"
- Barra de mudanças pendentes: "N mudanças sugeridas" + [Aplicar] [Descartar]

### Footer

- `[Cancelar]` — esquerda
- `[Anterior]` `[Próximo]` — centro-direita (navegação sequencial)
- `[Salvar Agente]` — visível em qualquer step (btn primary cyan)

### Responsividade

- Em telas < 1200px: chat vira drawer/bottom sheet
- Em telas < 900px: sidebar colapsa para ícones only

---

## Parte 2 — Company Knowledge Central (`/company-knowledge`)

### Propósito

Página central para gerenciar todo o conhecimento da empresa. Os dados ingeridos aqui ficam disponíveis para qualquer agente IA selecionar via step 6 do wizard.

### Rota

`/company-knowledge` — acessível pelo menu lateral do sistema (seção "Configurações" ou "IA")

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│  Company Knowledge — Base de Conhecimento da Empresa    │
│  "Centralize informações que seus agentes IA usam"      │
├─────────────────────────────────────────────────────────┤
│  [+ Adicionar Fonte]  [Filtros: tipo, status]  [Buscar] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Card Fonte ──────────────────────────────────────┐  │
│  │ 📄 Manual do Produto v3.pdf                       │  │
│  │ PDF • 42 páginas • 156 chunks • Indexado ✅       │  │
│  │ Última sync: 03/04/2026 14:30                     │  │
│  │ Usado por: Atena, Hermes (2 agentes)              │  │
│  │ [Re-indexar] [Editar] [Remover]                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Card Fonte ──────────────────────────────────────┐  │
│  │ 🌐 sismais.com.br (scraping)                     │  │
│  │ Website • 23 páginas • 89 chunks • Indexado ✅    │  │
│  │ Auto-sync: semanal • Próxima: 07/04/2026         │  │
│  │ Usado por: todos os agentes                       │  │
│  │ [Re-indexar] [Editar] [Remover]                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tipos de Fonte Suportados

| Tipo | Ícone | Ingestão | Auto-sync |
|------|-------|----------|-----------|
| **PDF** | 📄 | Upload → parse → chunk → embed | Não (manual re-index) |
| **Imagem** | 🖼️ | Upload → OCR/vision → chunk → embed | Não |
| **DOCX/TXT** | 📝 | Upload → parse → chunk → embed | Não |
| **Website** | 🌐 | URL → scraping (Firecrawl) → chunk → embed | Sim (configurável: diário/semanal/mensal) |
| **Rede Social** | 📱 | URL perfil → scraping posts/bio → chunk → embed | Sim |
| **Confluence** | 🔗 | Space/page ID → API → chunk → embed | Sim |
| **Zoho Desk** | 🔗 | KB articles → API → chunk → embed | Sim |

### Dialog "Adicionar Fonte"

Wizard de 3 steps:

**Step 1 — Tipo de Fonte**
Grid de cards selecionáveis com os 7 tipos acima.

**Step 2 — Configuração (varia por tipo)**

- **Upload (PDF/Imagem/DOCX):** Dropzone com drag & drop, multi-file
- **Website:** URL base + profundidade de crawl (1-5 níveis) + filtro de paths + frequência de sync
- **Rede Social:** Plataforma (Instagram/Facebook/LinkedIn) + URL do perfil + tipo de conteúdo (bio, posts, sobre)
- **Confluence:** URL da instância + Space key + token de API + filtro de labels
- **Zoho Desk:** URL + API key + filtro de categorias

**Step 3 — Processamento**
- Preview dos documentos/páginas encontrados
- Botão "Processar e Indexar"
- Progress bar com status: Coletando → Parseando → Chunking → Embedding → Indexado

### Tabela de Banco de Dados

Nova tabela `company_knowledge_sources`:

```sql
CREATE TABLE company_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- pdf, image, docx, website, social, confluence, zoho
  config JSONB NOT NULL DEFAULT '{}',
  -- config examples:
  -- website: { url, depth, paths_filter, sync_frequency }
  -- confluence: { base_url, space_key, api_token_encrypted, label_filter }
  -- social: { platform, profile_url, content_types }
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, indexed, error
  chunks_count INT DEFAULT 0,
  pages_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_frequency TEXT, -- null, daily, weekly, monthly
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Os chunks gerados vão para a tabela existente `ai_knowledge_base` com um campo `source_id` referenciando esta tabela.

### Step 6 do Wizard — AgentKnowledgeSelector

Componente novo que lista as fontes cadastradas em `/company-knowledge`:

- Grid de cards com checkbox para selecionar quais fontes o agente usa
- Filtro por tipo de fonte
- Badge mostrando quantidade de chunks por fonte
- Link "Gerenciar fontes →" que abre `/company-knowledge` em nova aba
- Salva a seleção em `ai_agents.knowledge_sources` (novo campo JSONB array de source_ids)

---

## Parte 3 — Edge Functions Necessárias

| Function | Propósito |
|----------|----------|
| `company-knowledge-ingest` | Processa upload de arquivos (PDF parse, OCR, chunking, embedding) |
| `company-knowledge-scrape` | Scraping de websites via Firecrawl + chunking + embedding |
| `company-knowledge-social` | Scraping de redes sociais + processamento |
| `company-knowledge-confluence` | Sync com Confluence API |
| `company-knowledge-zoho` | Sync com Zoho Desk API |
| `company-knowledge-sync` | Cron job para auto-sync das fontes configuradas |

### Modificação no agent-executor

O `agent-executor` precisa ser atualizado para, ao buscar RAG, filtrar por `source_id IN (fontes selecionadas pelo agente)` em vez de buscar tudo.

---

## Parte 4 — Migração de Dados

- Dados existentes em `AgentBriefing` (empresa, produtos, público-alvo) migram para uma fonte tipo "manual" na nova tabela
- `AgentAdvanced.tsx` pode ser removido (já não é usado)
- O campo `ai_agents.support_config` continua armazenando políticas e configurações não-RAG

---

## Decisões de Design

1. **Chat sempre visível** — o Copiloto IA não é mais uma aba, é um painel fixo acessível em todos os steps
2. **Preview em tempo real** — card colapsável no topo do chat mostra resumo atualizado do agente
3. **Navegação livre** — steps não obrigam sequência, pode pular para qualquer um
4. **Conhecimento centralizado** — fontes de dados da empresa são gerenciadas numa página dedicada, agentes apenas selecionam
5. **Save em qualquer step** — botão salvar sempre visível, não precisa ir até o último step
6. **Sugestões contextuais** — chat mostra prompts sugeridos relevantes ao step ativo
