# Spec: Fase 2B — Thinking Visível (Tab "Raciocínio")

**Data:** 2026-03-21
**Status:** Draft
**Autor:** Claude Opus 4.6 + Marcio S.
**Branch:** `claude/sismais-support-system-JCMCi`
**Depende de:** Fase 2A (Governança IA — guardrails, confidence_reason, flagged_for_review)

---

## 1. Objetivo

Dar transparência ao raciocínio dos agentes IA adicionando uma tab "Raciocínio" no painel lateral do inbox. O supervisor/agente humano poderá ver **por que** a IA respondeu daquela forma — quais documentos consultou, que dados do cliente usou, sinais de confiança e a explicação em linguagem natural gerada pelo próprio LLM.

### Valor entregue

- **Confiança:** Supervisor valida se a IA "pensou certo" antes de aprovar
- **Debugging:** Identifica rapidamente respostas baseadas em KB desatualizada ou sem dados do cliente
- **Treinamento:** Insumo para feedback loop — se o raciocínio está errado, a resposta também está
- **Compliance:** Audit trail de como a IA chegou à resposta (LGPD Art. 20 — decisões automatizadas)

---

## 2. Decisões de Design

| Decisão | Escolha | Alternativas descartadas |
|---------|---------|------------------------|
| Abordagem de dados | Híbrida: sinais objetivos + explicação LLM | Só sinais (pouco contexto) / Só CoT (caro) |
| Posição da tab | Grupo IA, 3a posição (após Análise e Cockpit) | Dentro de Análise / Substituir IA Logs |
| Layout do conteúdo | Dashboard de sinais + texto explicativo | Timeline de steps |
| Geração do raciocínio | Bloco `<reasoning>` no prompt do LLM | Template backend sem LLM |

---

## 3. Arquitetura

### 3.1 Fluxo de Dados

```
agent-executor (Edge Function)
  ├── System prompt inclui instrução de <reasoning>
  ├── LLM retorna: <reasoning>...</reasoning>\n\nResposta normal
  ├── Parser extrai reasoning_text e limpa content
  ├── Calcula sinais de confiança (já existente)
  └── Salva em ai_messages:
        ├── content (sem <reasoning>)
        ├── reasoning_text (novo campo)
        ├── reasoning_signals (novo campo JSONB)
        ├── confidence, confidence_reason (existentes)
        └── tools_used, rag_sources (existentes)

Frontend (AIAnalysisPanel)
  ├── Nova tab 'reasoning' no grupo IA
  ├── Query: ai_messages WHERE conversation_id AND role='assistant'
  ├── Renderiza: seletor de mensagens → sinais → explicação
  └── Fallback para mensagens sem reasoning_text
```

### 3.2 Schema: Nova Migration

```sql
-- Adicionar campos de raciocínio à ai_messages
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS reasoning_text TEXT CHECK (char_length(reasoning_text) <= 2000),
  ADD COLUMN IF NOT EXISTS reasoning_signals JSONB DEFAULT '{}';

-- Índice para queries da tab (conversa + role + ordem)
CREATE INDEX IF NOT EXISTS idx_ai_messages_reasoning
  ON ai_messages (conversation_id, role, created_at DESC)
  WHERE role = 'assistant';

-- Comentários para documentação
COMMENT ON COLUMN ai_messages.reasoning_text IS 'Explicação em linguagem natural gerada pelo LLM sobre seu raciocínio';
COMMENT ON COLUMN ai_messages.reasoning_signals IS 'Sinais estruturados de confiança: {kb_match, specialty_alignment, guardrails, hedging, tools, client_data}';
```

**Campo `reasoning_signals` (JSONB):** Estrutura os sinais de confiança para renderização direta no frontend, sem precisar re-parsear `confidence_reason`:

```typescript
interface ReasoningSignals {
  kb_match: {
    status: 'strong' | 'partial' | 'none' | 'disabled'
    score: number | null        // similaridade máxima
    docs_count: number          // docs encontrados
    top_doc_title?: string      // título do doc mais relevante
  }
  specialty_alignment: {
    status: 'aligned' | 'partial' | 'misaligned'
    agent_specialty: string     // ex: 'support'
    detected_intent: string     // ex: 'suporte_tecnico'
  }
  guardrails: {
    violations: number
    warnings: number
    details?: string[]          // ex: ['PII detectado: CPF mascarado']
  }
  hedging: {
    detected: boolean
    severity: 'none' | 'light' | 'moderate' | 'heavy'
    penalty: number             // ex: -0.05
  }
  tools_used: string[]          // ex: ['sismais_lookup', 'kb_search']
  client_data: {
    available: boolean
    source?: string             // ex: 'sismais_gl'
    fields?: string[]           // ex: ['plano', 'modulo_fiscal']
  }
}
```

### 3.3 Segurança

- **RLS:** `reasoning_text` e `reasoning_signals` seguem as mesmas policies existentes em `ai_messages` — acessível apenas por usuários autenticados da mesma organização
- **Sanitização:** O `reasoning_text` vindo do LLM é texto puro renderizado com `whitespace-pre-wrap`, sem `dangerouslySetInnerHTML` — previne XSS
- **PII no raciocínio:** Reutilizar os mesmos `PII_PATTERNS` já definidos no agent-executor (seção 9b, linhas 679-693) para sanitizar o `reasoning_text` antes do INSERT. Não existe uma função `maskPII` separada — a lógica é inline com `String.replace(regex, '[DADOS PROTEGIDOS]')`
- **Rate limiting:** Nenhum endpoint novo — usa query Supabase client-side com RLS

### 3.4 Otimização

- **Query eficiente:** O índice parcial `idx_ai_messages_reasoning` cobre exatamente o padrão de acesso (assistant messages por conversa, ordenado por data DESC)
- **Paginação:** Carregar apenas as últimas 10 mensagens do assistente por conversa. Botão "carregar anteriores" se houver mais
- **Cache React Query:** `queryKey: ['reasoning', conversationId]` com `staleTime: 30s`. Invalidar via `queryClient.invalidateQueries({ queryKey: ['reasoning', conversationId] })` quando novas mensagens chegam (hookar no mesmo realtime subscription do inbox)
- **Lazy loading da tab:** Conteúdo só carrega quando a tab é ativada (já é o padrão do AIAnalysisPanel)
- **JSONB vs TEXT:** `reasoning_signals` como JSONB permite queries futuras (ex: "mostre todas as mensagens com kb_match = 'none'") sem parsing client-side

### 3.5 Escalabilidade

- **Token budget:** Instrução de reasoning no prompt usa ~30 tokens fixos. Resposta do LLM adiciona ~50-100 tokens. Para 1000 mensagens/dia = ~100K tokens extras/dia (~US$ 0.01 com Gemini Flash)
- **Storage:** `reasoning_text` médio ~200 chars + `reasoning_signals` ~500 bytes JSON. Para 1M mensagens = ~700MB — negligível
- **Sem breaking changes:** Campo nullable, mensagens antigas continuam funcionando. Frontend mostra fallback elegante

---

## 4. Mudanças no agent-executor

### 4.1 System Prompt — Instrução de Reasoning

Adicionar ao final do system prompt montado:

```
Antes de responder, inclua um bloco <reasoning> explicando brevemente:
- Quais documentos da base de conhecimento você consultou (se houver)
- Que dados do cliente você usou (se disponíveis)
- Por que escolheu essa abordagem de resposta
Mantenha o raciocínio conciso (2-4 frases). Não repita o conteúdo da resposta.
```

### 4.2 Parser de Reasoning

Após receber a resposta do LLM, antes de salvar:

```typescript
function extractReasoning(rawContent: string): { content: string; reasoning: string | null } {
  const match = rawContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)
  if (!match) return { content: rawContent.trim(), reasoning: null }

  const reasoning = match[1].trim().slice(0, 2000) // hard limit para evitar bloat
  const content = rawContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim() // global flag para múltiplos blocos
  return { content, reasoning }
}
```

### 4.3 Montagem do reasoning_signals

Após calcular confiança (linha ~676 do agent-executor atual), montar o objeto usando as variáveis reais do código:

```typescript
// Variáveis já disponíveis neste ponto do código:
// - ragDocuments: array de docs RAG com .similarity e .title
// - maxSimilarity: Math.max(...ragDocuments.map(d => d.similarity || 0)) — já calculado na linha 616
// - agent: objeto do agente com .rag_enabled, .specialty
// - analysis: objeto com .intent (do message-analyzer)
// - hedgingCount: number — contagem de padrões de hedging (linha 656)
// - toolsUsed: string[] — ferramentas executadas pelo agente
// - guardrailsTriggered: string[] — guardrails ativados (PII, temas sensíveis) (linha 684)
// - conversationData: dados da conversa com .helpdesk_client_id
// - matchingSpecialties: string[] — specialties que batem com o intent (linha 640)

const reasoningSignals = {
  kb_match: {
    status: ragDocuments.length > 0
      ? (maxSimilarity >= 0.8 ? 'strong' : 'partial')
      : (agent.rag_enabled ? 'none' : 'disabled'),
    score: ragDocuments.length > 0 ? maxSimilarity : null,
    docs_count: ragDocuments.length,
    top_doc_title: ragDocuments[0]?.title || undefined,
  },
  specialty_alignment: {
    status: matchingSpecialties.length === 0 ? 'aligned'  // sem mapeamento = neutro
      : matchingSpecialties.includes(agent.specialty) ? 'aligned' : 'misaligned',
    agent_specialty: agent.specialty || 'unknown',
    detected_intent: analysis?.intent || 'unknown',
  },
  guardrails: {
    violations: guardrailsTriggered.filter(g => g.startsWith('PII')).length,
    warnings: guardrailsTriggered.filter(g => !g.startsWith('PII')).length,
    details: guardrailsTriggered.length > 0 ? guardrailsTriggered : undefined,
  },
  hedging: {
    detected: hedgingCount > 0,
    severity: hedgingCount === 0 ? 'none'
      : hedgingCount === 1 ? 'light' : 'heavy',
    penalty: hedgingCount >= 2 ? -0.15 : hedgingCount === 1 ? -0.08 : 0,
  },
  tools_used: toolsUsed,
  client_data: {
    available: !!conversationData?.helpdesk_client_id,
    source: conversationData?.helpdesk_client_id ? 'sismais_gl' : undefined,
  },
}
```

### 4.4 Sanitização de PII no Reasoning

Reutilizar os mesmos `PII_PATTERNS` inline (linhas 679-693 do agent-executor) no `reasoning_text`:

```typescript
// Após extractReasoning(), aplicar os mesmos PII_PATTERNS no reasoning_text
if (reasoning) {
  for (const [type, regex] of Object.entries(PII_PATTERNS)) {
    regex.lastIndex = 0
    if (regex.test(reasoning)) {
      regex.lastIndex = 0
      reasoning = reasoning.replace(regex, '[DADOS PROTEGIDOS]')
    }
  }
}
```

---

## 5. Mudanças no Frontend

### 5.1 AIAnalysisPanel — Nova Tab

```typescript
// Adicionar ao TabValue
type TabValue = 'analysis' | 'cockpit' | 'reasoning' | 'ticket' | 'cliente' | 'metricas' | 'historico' | 'ia_logs' | 'tramitacao'

// Adicionar ao array tabs (posição 2, entre cockpit e ticket)
{ id: 'reasoning', icon: Lightbulb, label: 'Raciocínio' }

// ATENÇÃO: shift de índices nos tabGroups
// Antes: IA=[0,1] TKT=[2,3] REL=[4,5,6,7]
// Depois: IA=[0,1,2] TKT=[3,4] REL=[5,6,7,8]
{ label: 'IA',  tabs: [tabs[0], tabs[1], tabs[2]] },  // análise, cockpit, raciocínio
{ label: 'TKT', tabs: [tabs[3], tabs[4]] },            // ticket, cliente
{ label: 'REL', tabs: [tabs[5], tabs[6], tabs[7], tabs[8]] }, // métricas, histórico, ia_logs, tramitação
```

### 5.2 Componente ReasoningTab

Novo componente `src/components/inbox/ReasoningTab.tsx`:

**Props:**
```typescript
interface ReasoningTabProps {
  conversationId: string
}
```

**Estrutura:**
1. **Seletor de mensagens** — pills horizontais com scroll, mostrando as últimas 10 mensagens do assistente
2. **Bloco de confiança** — número grande (%) + barra de progresso com gradiente (vermelho < 50% < amarelo < 70% < verde)
3. **Lista de sinais** — 6 linhas, cada uma com:
   - Ícone em quadrado colorido (24x24, rounded-md)
   - Label em texto secundário
   - Valor com cor semântica (emerald/amber/red)
4. **Separador** (dashed border)
5. **Bloco de explicação** — texto com `border-left: 3px solid cyan`, fundo `bg-muted`, `whitespace-pre-wrap`
6. **Fallback** — se `reasoning_text` é null: ícone info + "Raciocínio não disponível para esta mensagem"

**Query:**
```typescript
const { data: messages } = useQuery({
  queryKey: ['reasoning', conversationId],
  queryFn: async () => {
    const { data } = await supabase
      .from('ai_messages')
      .select('id, content, confidence, confidence_reason, tools_used, rag_sources, reasoning_text, reasoning_signals, created_at')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(10)
    return data
  },
  staleTime: 30_000,
  enabled: !!conversationId,
})
```

### 5.3 Mapeamento Visual dos Sinais

| Sinal | Ícone | Bom (green) | Médio (amber) | Ruim (red) |
|-------|-------|-------------|---------------|------------|
| KB Match | BookOpen | strong (≥0.8) | partial (<0.8) | none |
| Specialty | Target | aligned | partial | misaligned |
| Guardrails | Shield | 0 violações | warnings > 0 | violations > 0 |
| Hedging | AlertTriangle | none | light | moderate/heavy |
| Tools | Wrench | usou tools | — | — (neutral) |
| Client Data | User | disponível | — | indisponível |

---

## 6. Arquivos Afetados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `supabase/migrations/XXXX_reasoning_fields.sql` | **Novo** — migration |
| `supabase/functions/agent-executor/index.ts` | **Editar** — prompt, parser, signals, save |
| `src/components/inbox/ReasoningTab.tsx` | **Novo** — componente da tab |
| `src/components/inbox/AIAnalysisPanel.tsx` | **Editar** — adicionar tab ao grupo IA |
| `src/integrations/supabase/types.ts` | **Atualizar** — regenerar tipos (automático) |

---

## 7. Fora de Escopo

- Streaming do raciocínio em tempo real
- Edição/anotação do raciocínio pelo supervisor
- Comparação de raciocínio entre mensagens
- Exportação do raciocínio
- Dashboard agregado de sinais (futuro — Fase analytics)

---

## 8. Checklist de Qualidade

- [ ] Migration é idempotente (IF NOT EXISTS)
- [ ] Índice parcial cobre o padrão de acesso exato
- [ ] PII mascarada no reasoning_text antes do INSERT
- [ ] Frontend não usa dangerouslySetInnerHTML
- [ ] Fallback elegante para mensagens sem reasoning
- [ ] React Query com staleTime para evitar re-fetches
- [ ] Tab só carrega dados quando ativada (lazy)
- [ ] Cores seguem paleta GMS (CLAUDE.md seção UX)
- [ ] Contraste WCAG AA em todos os sinais coloridos
- [ ] Campo nullable — zero breaking changes
