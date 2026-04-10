# Prompt Lovable: Agent Squads - Orquestração Multi-Agente

**Projeto:** Sismais Assist Chat
**Feature:** Agent Squads - Sistema de times de agentes IA com orquestração em cadeia
**Idioma:** Português (Brasil) para toda UI, inglês para código/variáveis

---

## 1. VISÃO GERAL

Construa a funcionalidade **"Agent Squads"** que permite criar **times de agentes IA** que trabalham juntos em tarefas complexas. Uma squad tem uma hierarquia:

- **Líder** (recebe a tarefa do usuário/cliente)
- **Gerente** (analisa, delega e coordena os membros)
- **Membros** (agentes especializados que executam em sequência ou paralelo)

O fluxo completo funciona assim: o usuário envia uma mensagem → o Líder recebe → o Gerente delega → os Membros executam suas etapas → os resultados são agregados → o Gerente sintetiza a resposta final → retorna ao usuário.

**Toda a criação e configuração das squads deve ser feita via chat conversacional** (linguagem natural), com **visualização de fluxo visual** usando ReactFlow mostrando a estrutura da squad.

Este sistema se integra com o sistema de `ai_agents` existente. Agentes podem pertencer a squads e também trabalhar individualmente. A orquestração de squads é uma camada adicional sobre o `orchestrator` e `agent-executor` existentes.

---

## 2. STACK TÉCNICA (já instalada no projeto)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | TailwindCSS + shadcn/ui (Radix UI) |
| Estado servidor | TanStack React Query v5 |
| Roteamento | React Router v6 |
| Backend/DB | Supabase (PostgreSQL + RLS) |
| Edge Functions | Deno (TypeScript) |
| Fluxo Visual | ReactFlow (já instalado, `import ReactFlow from 'reactflow'`) |
| IA/LLM | OpenRouter (Gemini 2.0 Flash) + OpenAI (embeddings) |
| Ícones | lucide-react |
| Notificações | sonner (`import { toast } from 'sonner'`) |
| Classes CSS | `cn()` de `@/lib/utils` |

---

## 3. BANCO DE DADOS — SQL Migrations

Criar as seguintes tabelas no Supabase. Cada tabela precisa de Row, Insert, Update types + RLS policies (habilitar para todos os usuários autenticados com bypass para `service_role`).

### Tabela: `ai_agent_squads`

```sql
CREATE TABLE ai_agent_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'support' CHECK (type IN ('support', 'sales', 'cs', 'custom')),
  icon TEXT DEFAULT 'users',
  color TEXT DEFAULT '#8B5CF6',
  leader_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  manager_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  execution_mode TEXT NOT NULL DEFAULT 'sequential' CHECK (execution_mode IN ('sequential', 'parallel', 'conditional')),
  is_active BOOLEAN DEFAULT true,
  max_execution_time_seconds INTEGER DEFAULT 300,
  fallback_behavior TEXT DEFAULT 'escalate_human' CHECK (fallback_behavior IN ('escalate_human', 'retry', 'skip_step', 'abort')),
  squad_config JSONB DEFAULT '{}',
  total_executions INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_squads_type ON ai_agent_squads(type);
CREATE INDEX idx_squads_active ON ai_agent_squads(is_active);

ALTER TABLE ai_agent_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON ai_agent_squads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Tabela: `ai_squad_members`

```sql
CREATE TABLE ai_squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES ai_agent_squads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'manager', 'member')),
  position INTEGER NOT NULL DEFAULT 0,
  step_label TEXT,
  step_description TEXT,
  skills TEXT[] DEFAULT '{}',
  custom_prompt TEXT,
  input_mapping JSONB DEFAULT '{}',
  output_mapping JSONB DEFAULT '{}',
  condition JSONB,
  timeout_seconds INTEGER DEFAULT 60,
  retry_count INTEGER DEFAULT 0,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(squad_id, agent_id)
);

CREATE INDEX idx_squad_members_squad ON ai_squad_members(squad_id);
CREATE INDEX idx_squad_members_agent ON ai_squad_members(agent_id);

ALTER TABLE ai_squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON ai_squad_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Tabela: `ai_squad_executions`

```sql
CREATE TABLE ai_squad_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES ai_agent_squads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  trigger_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_duration_ms INTEGER,
  total_cost_usd NUMERIC(10,6) DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  result_summary TEXT,
  final_output JSONB,
  error_message TEXT,
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER DEFAULT 0
);

CREATE INDEX idx_squad_executions_squad ON ai_squad_executions(squad_id);
CREATE INDEX idx_squad_executions_status ON ai_squad_executions(status);

ALTER TABLE ai_squad_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON ai_squad_executions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Tabela: `ai_squad_execution_steps`

```sql
CREATE TABLE ai_squad_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES ai_squad_executions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES ai_squad_members(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data JSONB,
  output_data JSONB,
  agent_response TEXT,
  confidence NUMERIC(3,2),
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_execution_steps_exec ON ai_squad_execution_steps(execution_id);

ALTER TABLE ai_squad_execution_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON ai_squad_execution_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Alterar tabela existente: `ai_conversations`

```sql
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS squad_id UUID REFERENCES ai_agent_squads(id) ON DELETE SET NULL;
CREATE INDEX idx_conversations_squad ON ai_conversations(squad_id);
```

**IMPORTANTE:** Após criar essas tabelas, adicionar os tipos em `src/integrations/supabase/types.ts` seguindo o padrão exato das tabelas existentes (Row, Insert, Update types com Relationships).

---

## 4. EDGE FUNCTIONS (Deno)

### 4.1 Edge Function: `squad-builder`

**Arquivo:** `supabase/functions/squad-builder/index.ts`

Seguir o padrão exato da edge function `skill-agent-creator/index.ts`. Esta função é uma IA conversacional que cria e configura squads via chat.

**Comportamento:**
- Recebe `{ messages: ChatMessage[], context?: string }` no body
- Busca dados da plataforma: agentes existentes, squads existentes, especialidades disponíveis
- Constrói system prompt explicando o conceito de squads, os agentes disponíveis e as especialidades
- Usa tool calling com a tool `generate_squad_config`
- Faz no máximo 2 perguntas de esclarecimento antes de gerar a configuração
- Retorna `{ type: 'message', message: '...' }` ou `{ type: 'config', tool: 'generate_squad_config', config: {...}, message: '...' }`

**System Prompt da IA:**
```
Você é um especialista em configuração de squads de agentes IA para o Sismais Helpdesk.

Squads são times de agentes IA que trabalham juntos em cadeia para resolver tarefas complexas.
Cada squad tem:
- Um LÍDER: recebe a tarefa e faz a primeira análise
- Um GERENTE: coordena os membros e sintetiza o resultado final
- MEMBROS: agentes especializados que executam etapas específicas

Tipos de squad:
- support: Suporte técnico ao cliente (triagem, diagnóstico, resolução, documentação)
- sales: Time de vendas (prospecção, qualificação, apresentação, fechamento)
- cs: Customer Success (onboarding, acompanhamento, retenção, upsell)
- custom: Personalizado

Modos de execução:
- sequential: Membros executam em ordem (1→2→3→4)
- parallel: Membros executam ao mesmo tempo
- conditional: Gerente decide quais membros ativar baseado no contexto

Agentes disponíveis na plataforma:
{lista_de_agentes}

Squads existentes:
{lista_de_squads}

Instruções:
1. Entenda o que o usuário quer criar
2. Faça no máximo 2 perguntas se faltar informação essencial
3. Gere a configuração completa da squad usando a tool generate_squad_config
4. Cada membro deve ter um step_label claro e um step_description explicando o que faz
5. Se o usuário quer usar agentes que não existem, crie novos agentes como parte da squad
6. Sempre sugira o execution_mode mais adequado para o tipo de squad
7. Responda sempre em português brasileiro
```

**Tool Schema:**
```json
{
  "name": "generate_squad_config",
  "description": "Gera a configuração completa de uma squad de agentes",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Nome da squad" },
      "description": { "type": "string", "description": "Descrição do que a squad faz" },
      "type": { "type": "string", "enum": ["support", "sales", "cs", "custom"] },
      "color": { "type": "string", "description": "Cor hex da squad" },
      "execution_mode": { "type": "string", "enum": ["sequential", "parallel", "conditional"] },
      "fallback_behavior": { "type": "string", "enum": ["escalate_human", "retry", "skip_step", "abort"] },
      "leader": {
        "type": "object",
        "properties": {
          "agent_id": { "type": "string", "description": "UUID do agente existente, ou null para criar novo" },
          "create_agent": {
            "type": "object",
            "description": "Configuração para criar novo agente (se agent_id for null)",
            "properties": {
              "name": { "type": "string" },
              "specialty": { "type": "string" },
              "system_prompt": { "type": "string" },
              "description": { "type": "string" }
            }
          },
          "step_label": { "type": "string" },
          "step_description": { "type": "string" }
        }
      },
      "manager": {
        "type": "object",
        "properties": {
          "agent_id": { "type": "string" },
          "create_agent": { "type": "object" },
          "step_label": { "type": "string" },
          "step_description": { "type": "string" }
        }
      },
      "members": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "agent_id": { "type": "string" },
            "create_agent": { "type": "object" },
            "step_label": { "type": "string" },
            "step_description": { "type": "string" },
            "skills": { "type": "array", "items": { "type": "string" } },
            "position": { "type": "number" },
            "timeout_seconds": { "type": "number" },
            "is_optional": { "type": "boolean" }
          }
        }
      }
    },
    "required": ["name", "type", "execution_mode", "leader", "manager", "members"]
  }
}
```

**Incluir `corsHeaders` e handler `OPTIONS` conforme padrão existente.**

---

### 4.2 Edge Function: `squad-executor`

**Arquivo:** `supabase/functions/squad-executor/index.ts`

Motor de execução que orquestra todos os membros da squad em sequência.

**Input:**
```json
{
  "squad_id": "uuid",
  "conversation_id": "uuid (opcional)",
  "message": "texto da tarefa/mensagem",
  "context": {}
}
```

**Fluxo de Execução:**

```
1. Buscar config da squad com todos os membros (ORDER BY position)
2. Criar registro em ai_squad_executions (status: 'running')
3. Executar LÍDER:
   a. Criar step em ai_squad_execution_steps
   b. Chamar agent-executor com a mensagem original
   c. Salvar output do líder
4. Executar GERENTE:
   a. Passar output do líder + mensagem original
   b. Gerente analisa e prepara plano de delegação
   c. Salvar output do gerente
5. Para cada MEMBRO (baseado em execution_mode):
   a. Se sequential: executar um por um na ordem de position
   b. Se parallel: executar todos simultaneamente com Promise.all
   c. Se conditional: usar output do gerente para decidir quais ativar
   d. Para cada membro:
      - Criar step record (status: 'running')
      - Input = output do passo anterior + contexto do gerente
      - Chamar agent-executor para o agente do membro
      - Atualizar step (status: 'completed', output, confidence, cost, duration)
      - Se falhar e is_optional=false: aplicar fallback_behavior
6. Agregar todos os outputs dos membros
7. Passar agregado de volta ao GERENTE para síntese final
8. Atualizar ai_squad_executions (status: 'completed', total_cost, total_duration)
9. Retornar resposta final sintetizada
```

**Output:**
```json
{
  "message": "resposta final sintetizada",
  "execution_id": "uuid",
  "steps_completed": 5,
  "total_duration_ms": 12000,
  "total_cost_usd": 0.0045,
  "confidence": 0.85
}
```

**Incluir `corsHeaders` e handler `OPTIONS` conforme padrão existente.**

---

### 4.3 Atualizar Edge Function: `orchestrator`

Modificar `supabase/functions/orchestrator/index.ts` para também considerar squads:

- Após buscar agentes ativos, buscar também squads ativas com seus membros
- Incluir squads no prompt do LLM de roteamento:
  ```
  Squads disponíveis:
  ID | Nome | Tipo | Descrição | Membros
  uuid | Squad Suporte | support | Time completo de suporte | Triagem, Diagnóstico, Resolução
  ```
- Se uma squad for selecionada, retornar: `{ action: 'squad', squad_id: '...', squad_name: '...', reason: '...' }`
- Regra: usar squad quando a mensagem precisa de processamento multi-etapa; usar agente individual para perguntas simples

---

### 4.4 Atualizar Edge Function: `process-incoming-message`

Modificar `supabase/functions/process-incoming-message/index.ts`:

- Após orquestração, verificar `orchestration.action`:
  - Se `'agent'`: comportamento atual (chamar agent-executor)
  - Se `'squad'`: invocar `squad-executor` com `squad_id` e `conversation_id`
  - Atualizar `ai_conversations` com `squad_id` quando squad é usada

---

## 5. FRONTEND — PÁGINAS

### 5.1 Página Principal: `/squads`

**Arquivo:** `src/pages/Squads.tsx`
**Rota:** Adicionar `<Route path="/squads" element={<Squads />} />` em `src/App.tsx`

**Layout (seguir padrão exato de `src/pages/Agents.tsx`):**

```
┌──────────────────────────────────────────────────────────┐
│  [Users icon] Squads de Agentes                          │
│  Gerencie seus times de agentes IA    [+ Criar Squad]    │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │        FLUXO VISUAL GERAL (ReactFlow)               │ │
│  │  [Input] → [Squad 1] → [Output]                     │ │
│  │           [Squad 2] → [Output]                       │ │
│  │           [Squad 3] → [Output]                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [Todos] [Suporte] [Vendas] [CS] [Custom]   ← Tabs      │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │  Squad Card 1  │  │  Squad Card 2  │                  │
│  │  - nome        │  │  - nome        │                  │
│  │  - tipo badge  │  │  - tipo badge  │                  │
│  │  - membros     │  │  - membros     │                  │
│  │  - métricas    │  │  - métricas    │                  │
│  │  [Editar][Test]│  │  [Editar][Test]│                  │
│  └────────────────┘  └────────────────┘                  │
│                                                          │
│  Estado vazio: "Crie sua primeira squad" com templates    │
└──────────────────────────────────────────────────────────┘
```

**Botão "Criar Squad":** Abre `SquadBuilderDialog` (criação via chat conversacional)

### 5.2 Página de Detalhe: `/squads/:id`

**Arquivo:** `src/pages/SquadDetail.tsx`
**Rota:** Adicionar `<Route path="/squads/:id" element={<SquadDetail />} />`

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  [←] Squad de Suporte   ● Ativo   [Suporte]  [Editar]   │
│                                                          │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │   FLUXO VISUAL (60%)    │  │   PAINEL (40%)       │   │
│  │                         │  │                      │   │
│  │  [Input]                │  │  [Membros] [Config]  │   │
│  │    ↓                    │  │  [Execuções][Métricas]│  │
│  │  [Líder: Triagem]       │  │                      │   │
│  │    ↓                    │  │  1. Líder Triagem ●   │   │
│  │  [Gerente: Suporte]     │  │  2. Gerente Suporte ●│   │
│  │    ↓       ↓       ↓    │  │  3. Diagnosticador ● │   │
│  │  [Diag] [Soluc] [Doc]   │  │  4. Solucionador ●   │   │
│  │    ↓       ↓       ↓    │  │  5. Documentador ●   │   │
│  │  [Output]               │  │                      │   │
│  │                         │  │  [+ Adicionar Membro]│   │
│  └─────────────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Playground da Squad: `/squads/playground/:id`

**Arquivo:** `src/pages/SquadPlayground.tsx`
**Rota:** Adicionar `<Route path="/squads/playground/:id" element={<SquadPlayground />} />`

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  [←] Playground: Squad de Suporte          [Novo Teste]  │
│                                                          │
│  ┌────────────────────┐  ┌───────────────────────────┐   │
│  │  CHAT (50%)        │  │  EXECUÇÃO AO VIVO (50%)   │   │
│  │                    │  │                           │   │
│  │  [User]: Meu       │  │  [Input] ✓ 0.2s          │   │
│  │  sistema não       │  │    ↓                      │   │
│  │  funciona          │  │  [Líder] ● executando...  │   │
│  │                    │  │    ↓                      │   │
│  │  [Squad]: Entendi, │  │  [Gerente] ○ pendente     │   │
│  │  já estou          │  │    ↓                      │   │
│  │  analisando...     │  │  [Diag] ○  [Sol] ○       │   │
│  │                    │  │    ↓                      │   │
│  │  ┌──────────────┐  │  │  [Output] ○              │   │
│  │  │ [textarea]   │  │  │                           │   │
│  │  │         [▶]  │  │  │  ─── Resumo ───          │   │
│  │  └──────────────┘  │  │  Tempo: 12.3s             │   │
│  │                    │  │  Custo: $0.0045            │   │
│  └────────────────────┘  │  Passos: 4/5              │   │
│                          └───────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Comportamento do Playground:**
- Chat à esquerda: usuário digita mensagem, envia para squad-executor
- Fluxo visual à direita: mostra nós iluminando em tempo real conforme cada step executa
- Cada nó mostra: nome do agente, status (pendente/executando/concluído/falhou), preview da resposta, confiança, tokens
- Animações: nós pendentes com opacity 50%, nós executando com pulse animado, nós concluídos com checkmark verde, nós falhados com borda vermelha

---

## 6. FRONTEND — COMPONENTES

Criar todos em `src/components/squads/`

### 6.1 `SquadCard.tsx`

Card para listagem de squads. **Seguir padrão de `src/components/agents/AgentListCard.tsx`.**

```
┌─────────────────────────────────────┐
│  ● Squad de Suporte    [Suporte]    │
│  Time completo de suporte técnico   │
│                                     │
│  Membros: ●●●●● 5 agentes          │
│  Modo: Sequencial                   │
│                                     │
│  Execuções: 142  |  Taxa: 94.2%     │
│  Tempo médio: 8.5s | Custo: $12.40  │
│                                     │
│  [Testar]  [Editar]  [···]          │
└─────────────────────────────────────┘
```

Props:
```typescript
interface SquadCardProps {
  squad: SquadWithMembers
  onEdit: (squad: SquadRow) => void
  onDelete: (id: string) => void
  onTest: (squad: SquadRow) => void
}
```

### 6.2 `SquadFlowCanvas.tsx`

Visualização ReactFlow interativa do fluxo da squad. **Seguir padrão exato de `src/components/agents/AgentFlowPipeline.tsx`.**

**Custom Node Types:**
- `squadInput`: Borda verde (#10b981), ícone `MessageSquare`, label "Mensagem Recebida"
- `squadLeader`: Borda roxa (#8b5cf6) com `ring-2 ring-violet-500/20`, ícone `Crown`, nome do agente líder
- `squadManager`: Borda azul (#3b82f6) com borda tracejada, ícone `ClipboardList`, nome do agente gerente
- `squadMember`: Borda na cor do agente, badge numérico da posição, step_label
- `squadOutput`: Borda verde (#10b981), ícone `CheckCircle2`, label "Resultado Final"

**Estilos de Edges:**
- Input → Líder: animated, stroke roxo
- Líder → Gerente: animated, stroke azul
- Gerente → Membros: sólido, stroke cinza com labels de step number
- Membros → Output: tracejado, stroke verde

**Props:**
```typescript
interface SquadFlowCanvasProps {
  squad: SquadWithMembers
  executionSteps?: ExecutionStep[] // para animação em tempo real
  onMemberClick?: (member: SquadMember) => void
  interactive?: boolean // true no detalhe, false na listagem
}
```

**Animação de execução ao vivo (quando executionSteps é passado):**
- Nós pendentes: opacity 50%, borda cinza
- Nós executando: borda com pulse animado, ícone `Loader2` girando
- Nós concluídos: opacity 100%, overlay com `CheckCircle2` verde
- Nós falhados: borda vermelha, overlay com `XCircle` vermelho

### 6.3 `SquadBuilderDialog.tsx`

Dialog de criação de squad via chat conversacional. **Seguir padrão EXATO de `src/components/agents/SkillAgentDialog.tsx`.**

**3 estados:**
- `'input'`: Textarea para descrever a squad + chips de templates rápidos
- `'chatting'`: Chat bubbles com a IA fazendo perguntas e o usuário respondendo
- `'preview'`: Preview visual da squad gerada com fluxo ReactFlow + botões "Criar Squad" / "Personalizar"

**Templates rápidos (chips clicáveis):**
```typescript
const SQUAD_TEMPLATES = [
  {
    label: 'Squad de Suporte',
    icon: Headphones,
    color: '#45E5E5',
    prompt: 'Preciso de um squad de suporte técnico completo com triagem, diagnóstico de problemas, resolução e documentação. O líder recebe a mensagem do cliente, o gerenciador analisa e distribui para o agente certo, e cada membro resolve sua parte especializada.',
  },
  {
    label: 'Squad de Vendas',
    icon: TrendingUp,
    color: '#10B981',
    prompt: 'Preciso de um squad de vendas com prospecção, qualificação de leads, apresentação de produto e fechamento. O líder recebe o lead, o gerenciador avalia o perfil, e cada membro conduz sua etapa do funil de vendas.',
  },
  {
    label: 'Squad de Customer Success',
    icon: Heart,
    color: '#F59E0B',
    prompt: 'Preciso de um squad de Customer Success com onboarding de novos clientes, acompanhamento periódico, retenção de clientes em risco e identificação de oportunidades de upsell.',
  },
  {
    label: 'Squad Personalizado',
    icon: Wand2,
    color: '#8B5CF6',
    prompt: '',
  },
]
```

**Fluxo do chat:**
1. Usuário seleciona template ou escreve descrição livre (mín 20 caracteres)
2. Chama edge function `squad-builder` com a mensagem
3. IA pode fazer até 2 perguntas de esclarecimento
4. IA retorna config completa via tool `generate_squad_config`
5. Preview mostra: nome da squad, tipo, membros com seus papéis, e mini fluxo ReactFlow
6. Botão "Criar Squad": aplica a config (cria agentes novos se necessário + cria squad + cria membros)
7. Botão "Personalizar": abre `SquadFormDialog` com os dados pré-preenchidos

### 6.4 `SquadFormDialog.tsx`

Dialog de edição manual da squad com tabs. **Seguir padrão de `src/components/agents/AgentFormDialog.tsx`.**

**Tabs:**
- **"Geral"**: Name, description, type select, color picker, icon select, execution_mode select, fallback_behavior select, max_execution_time_seconds, is_active toggle
- **"Membros"**:
  - Leader: select dropdown de ai_agents + step_label + step_description
  - Manager: select dropdown de ai_agents + step_label + step_description
  - Membros list com drag-to-reorder:
    - Cada linha: drag handle (GripVertical), badge posição, agent select, step_label input, skills tags, timeout input, optional toggle, remove button
  - Botão "+ Adicionar Membro"
- **"Fluxo"**: Preview ReactFlow read-only da squad configurada (usa `SquadFlowCanvas` com `interactive={false}`)
- **"Métricas"**: Métricas de execução da squad (total_executions, avg_execution_time_ms, success_rate, total_cost_usd)

### 6.5 `SquadExecutionTimeline.tsx`

Timeline vertical mostrando passos de execução.

```
┌──────────────────────────────────────┐
│  ● Líder: Triagem         ✓  0.8s   │
│  │  "Identifiquei problema de..."    │
│  │                                   │
│  ● Gerente: Suporte       ✓  0.3s   │
│  │  "Delegando para diagnóstico..."  │
│  │                                   │
│  ● Diagnosticador         ● 2.1s    │
│  │  "Analisando logs do sistema..."  │
│  │                                   │
│  ○ Solucionador           ○ ---      │
│  │                                   │
│  ○ Documentador           ○ ---      │
└──────────────────────────────────────┘
```

- Cada step: avatar/cor do agente, step_label, status badge (✓/●/✗/○), duração, preview da resposta (truncado)
- Steps executando: pulse effect animado na bolinha
- Steps falhados: bolinha vermelha com X
- Steps pendentes: bolinha cinza vazia

### 6.6 `SquadMemberRow.tsx`

Linha individual de membro para o formulário.

```
[≡] #3  [Select Agent ▼]  [Step Label]  [60s]  [Opcional ○]  [🗑]
```

Props:
```typescript
interface SquadMemberRowProps {
  member: Partial<SquadMemberInsert>
  agents: Agent[]
  position: number
  onChange: (updates: Partial<SquadMemberInsert>) => void
  onRemove: () => void
}
```

### 6.7 `SquadMetricsCard.tsx`

Card de métricas resumidas.

```
┌──────────────────────────────────┐
│  Total Execuções     142         │
│  Taxa de Sucesso     94.2%       │
│  Tempo Médio         8.5s        │
│  Custo Total         $12.40      │
│  Membro + Ativo      Diagnosticador │
└──────────────────────────────────┘
```

---

## 7. HOOKS

### 7.1 `useSquads.ts` (`src/hooks/useSquads.ts`)

**Seguir padrão exato de `src/hooks/useAgents.ts`:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types'
import { toast } from 'sonner'

type Squad = Tables<'ai_agent_squads'>
type SquadInsert = TablesInsert<'ai_agent_squads'>
type SquadUpdate = TablesUpdate<'ai_agent_squads'>

export function useSquads() {
  const queryClient = useQueryClient()

  const { data: squads, isLoading } = useQuery({
    queryKey: ['squads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_squads')
        .select('*, ai_squad_members(*, ai_agents(id, name, specialty, color, avatar_url))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const createSquad = useMutation({
    mutationFn: async (squad: SquadInsert) => {
      const { data, error } = await supabase.from('ai_agent_squads').insert(squad).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads'] })
      toast.success('Squad criada com sucesso!')
    },
    onError: (e: Error) => toast.error(`Erro ao criar squad: ${e.message}`)
  })

  const updateSquad = useMutation({
    mutationFn: async ({ id, ...updates }: SquadUpdate & { id: string }) => {
      const { data, error } = await supabase.from('ai_agent_squads').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads'] })
      toast.success('Squad atualizada!')
    }
  })

  const deleteSquad = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_agent_squads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads'] })
      toast.success('Squad removida!')
    }
  })

  return { squads: squads ?? [], isLoading, createSquad, updateSquad, deleteSquad }
}
```

### 7.2 `useSquadMembers.ts` (`src/hooks/useSquadMembers.ts`)

```typescript
export function useSquadMembers(squadId: string) {
  // Query membros de uma squad específica, ordenados por position
  // Mutations: addMember, removeMember, updateMember, reorderMembers
}
```

### 7.3 `useSquadExecutions.ts` (`src/hooks/useSquadExecutions.ts`)

```typescript
export function useSquadExecutions(squadId: string) {
  // Query execuções com steps, ordenados por started_at desc
  // Incluir subscription Supabase real-time para tracking de execução ao vivo
}
```

---

## 8. NAVEGAÇÃO — SIDEBAR

Atualizar `src/components/layout/Sidebar.tsx`:

Adicionar na categoria **"IA & Agentes"**, após "Agentes IA":
```typescript
{ icon: Users, label: 'Squads', path: '/squads' },
```

Importar `Users` de lucide-react.

---

## 9. INTEGRAÇÃO COM AI CONFIGURATOR

Adicionar contexto `'squad'` na página existente `src/pages/AIConfigurator.tsx`:

**Adicionar ao array CONTEXTS:**
```typescript
{ id: 'squad', label: 'Squad', icon: Users, description: 'Criar e configurar squads de agentes', color: 'text-purple-500' }
```

**Adicionar ao QUICK_PROMPTS:**
```typescript
squad: [
  'Criar um squad de suporte técnico completo',
  'Criar um squad de vendas com funil completo',
  'Montar um squad de Customer Success',
  'Criar um squad personalizado de atendimento',
]
```

**Adicionar ao TOOL_LABELS:**
```typescript
generate_squad_config: { label: 'Squad', icon: Users, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' }
```

**Atualizar função `applyConfig` para tratar `generate_squad_config`:**
1. Criar a squad na tabela `ai_agent_squads`
2. Para cada membro: se `agent_id` existe, usar o agente existente; se `create_agent` está preenchido, criar novo agente primeiro
3. Inserir todos os membros em `ai_squad_members` com suas posições e papéis
4. Retornar `{ id: squad.id }`

**Atualizar edge function `platform-ai-assistant`** para incluir a tool `generate_squad_config` quando o contexto for `'squad'`.

---

## 10. TEMPLATES PRÉ-CONFIGURADOS

### Squad de Suporte Técnico

```typescript
{
  name: 'Squad de Suporte Técnico',
  description: 'Time completo de suporte com triagem inteligente, diagnóstico técnico, resolução e documentação',
  type: 'support',
  color: '#45E5E5',
  execution_mode: 'conditional',
  fallback_behavior: 'escalate_human',
  leader: {
    name: 'Líder de Triagem',
    specialty: 'triage',
    step_label: 'Triagem',
    step_description: 'Recebe a mensagem do cliente, identifica o tipo de problema e a urgência, e direciona para a resolução adequada',
    system_prompt: 'Você é o líder de triagem do time de suporte. Sua função é receber a mensagem do cliente, identificar rapidamente o tipo de problema (técnico, financeiro, dúvida), avaliar a urgência (baixa, média, alta, crítica), e encaminhar com contexto claro para o gerente do time.'
  },
  manager: {
    name: 'Gerente de Suporte',
    specialty: 'support',
    step_label: 'Coordenação',
    step_description: 'Analisa a triagem, delega para os membros especialistas e sintetiza a resposta final ao cliente',
    system_prompt: 'Você é o gerente do time de suporte. Receba a análise do líder de triagem, decida quais membros do time precisam atuar, coordene o trabalho e sintetize todas as respostas em uma resposta final clara e útil para o cliente.'
  },
  members: [
    {
      name: 'Diagnosticador',
      specialty: 'support',
      step_label: 'Diagnóstico',
      step_description: 'Analisa o problema técnico, identifica causa raiz e documenta o diagnóstico',
      position: 0,
      skills: ['análise técnica', 'debug', 'logs'],
      system_prompt: 'Você é o especialista em diagnóstico técnico. Analise o problema reportado, identifique possíveis causas raiz, faça perguntas técnicas se necessário, e documente seu diagnóstico de forma clara.'
    },
    {
      name: 'Solucionador',
      specialty: 'support',
      step_label: 'Resolução',
      step_description: 'Aplica a solução para o problema diagnosticado, fornece instruções passo a passo',
      position: 1,
      skills: ['resolução', 'instruções', 'workarounds'],
      system_prompt: 'Você é o especialista em resolução. Com base no diagnóstico recebido, forneça a solução para o problema com instruções claras e passo a passo. Se não houver solução imediata, sugira workarounds.'
    },
    {
      name: 'Documentador',
      specialty: 'support',
      step_label: 'Documentação',
      step_description: 'Documenta o caso, atualiza base de conhecimento e prepara resposta final',
      position: 2,
      is_optional: true,
      skills: ['documentação', 'knowledge base', 'FAQ'],
      system_prompt: 'Você é o documentador do time. Registre o problema e a solução na base de conhecimento para referência futura. Prepare um resumo claro do caso.'
    },
    {
      name: 'Escalador',
      specialty: 'support',
      step_label: 'Escalação',
      step_description: 'Escala para atendimento humano quando necessário, com contexto completo',
      position: 3,
      is_optional: true,
      skills: ['escalação', 'priorização', 'SLA'],
      system_prompt: 'Você é o especialista em escalação. Quando o problema não pode ser resolvido automaticamente, prepare o contexto completo para o atendente humano: histórico, diagnóstico, tentativas de resolução, urgência e SLA.'
    }
  ]
}
```

### Squad de Vendas

```typescript
{
  name: 'Squad de Vendas',
  description: 'Funil completo de vendas com prospecção, qualificação, apresentação e fechamento',
  type: 'sales',
  color: '#10B981',
  execution_mode: 'sequential',
  fallback_behavior: 'escalate_human',
  leader: {
    name: 'Prospector SDR',
    specialty: 'sdr',
    step_label: 'Prospecção',
    step_description: 'Recebe o lead, faz a abordagem inicial e coleta informações básicas',
    system_prompt: 'Você é o SDR do time de vendas. Receba o lead, faça uma abordagem consultiva, identifique o perfil do cliente (tamanho da empresa, segmento, necessidades), e colete informações para qualificação.'
  },
  manager: {
    name: 'Gerente Comercial',
    specialty: 'sales',
    step_label: 'Gestão do Funil',
    step_description: 'Coordena o funil de vendas, decide próximos passos e sintetiza a proposta final',
    system_prompt: 'Você é o gerente comercial. Analise as informações do lead, coordene as etapas do funil, decida se o lead está qualificado para avançar e sintetize a proposta comercial final.'
  },
  members: [
    {
      name: 'Qualificador',
      specialty: 'sdr',
      step_label: 'Qualificação',
      step_description: 'Aplica critérios de qualificação (BANT/SPIN) e classifica o lead',
      position: 0,
      skills: ['BANT', 'SPIN', 'qualificação'],
      system_prompt: 'Você é o especialista em qualificação de leads. Aplique os critérios BANT (Budget, Authority, Need, Timeline) e classifique o lead como quente, morno ou frio. Identifique as dores principais e o potencial de compra.'
    },
    {
      name: 'Pesquisador',
      specialty: 'sales',
      step_label: 'Pesquisa',
      step_description: 'Pesquisa o contexto do cliente, segmento e concorrentes para personalizar abordagem',
      position: 1,
      skills: ['pesquisa', 'mercado', 'concorrentes'],
      system_prompt: 'Você é o pesquisador comercial. Com base nas informações do lead, pesquise sobre o segmento de atuação, desafios comuns, e como nosso produto/serviço resolve especificamente os problemas identificados. Forneça insights para personalizar a abordagem.'
    },
    {
      name: 'Proposteiro',
      specialty: 'sales',
      step_label: 'Proposta',
      step_description: 'Prepara proposta comercial personalizada com base na qualificação e pesquisa',
      position: 2,
      skills: ['proposta', 'pricing', 'ROI'],
      system_prompt: 'Você é o especialista em propostas. Com base na qualificação e pesquisa, prepare uma proposta comercial personalizada. Destaque o ROI, os benefícios específicos para o cliente, e sugira o melhor plano/pacote.'
    },
    {
      name: 'Closer',
      specialty: 'sales',
      step_label: 'Fechamento',
      step_description: 'Conduz a negociação final, trata objeções e fecha o negócio',
      position: 3,
      skills: ['negociação', 'objeções', 'fechamento'],
      system_prompt: 'Você é o closer. Conduza a negociação final com o lead. Trate as objeções mais comuns (preço, timing, concorrência), use técnicas de fechamento adequadas, e conduza o lead para a decisão de compra.'
    }
  ]
}
```

### Squad de Customer Success

```typescript
{
  name: 'Squad de Customer Success',
  description: 'Time de sucesso do cliente com onboarding, acompanhamento, retenção e upsell',
  type: 'cs',
  color: '#F59E0B',
  execution_mode: 'conditional',
  fallback_behavior: 'escalate_human',
  leader: {
    name: 'Líder CS',
    specialty: 'support',
    step_label: 'Recepção',
    step_description: 'Recebe o cliente, identifica o estágio do ciclo de vida e direciona para a etapa adequada',
    system_prompt: 'Você é o líder de Customer Success. Receba o cliente, identifique em qual estágio do ciclo de vida ele está (novo, ativo, em risco, inativo), e direcione para o membro adequado do time com contexto completo.'
  },
  manager: {
    name: 'Gerente de Sucesso',
    specialty: 'support',
    step_label: 'Coordenação CS',
    step_description: 'Coordena as ações de sucesso do cliente e sintetiza o plano de ação',
    system_prompt: 'Você é o gerente de Customer Success. Coordene as ações do time baseado no estágio do cliente, priorize as atividades, e sintetize um plano de ação claro para garantir o sucesso do cliente.'
  },
  members: [
    {
      name: 'Onboarder',
      specialty: 'support',
      step_label: 'Onboarding',
      step_description: 'Guia novos clientes na configuração e primeiros passos com o sistema',
      position: 0,
      skills: ['onboarding', 'treinamento', 'configuração'],
      system_prompt: 'Você é o especialista em onboarding. Guie novos clientes nos primeiros passos: configuração do sistema, treinamento básico, primeiras ações. Garanta que o cliente tenha um "primeiro valor" rápido e uma boa primeira impressão.'
    },
    {
      name: 'Acompanhador',
      specialty: 'support',
      step_label: 'Acompanhamento',
      step_description: 'Faz check-ins periódicos, monitora uso e identifica sinais de risco',
      position: 1,
      skills: ['check-in', 'monitoramento', 'health score'],
      system_prompt: 'Você é o especialista em acompanhamento. Faça check-ins com o cliente, monitore indicadores de uso (health score), identifique sinais de satisfação ou risco, e proponha ações para maximizar o valor que o cliente extrai do produto.'
    },
    {
      name: 'Retentor',
      specialty: 'support',
      step_label: 'Retenção',
      step_description: 'Atua em clientes em risco de churn com ações de retenção',
      position: 2,
      is_optional: true,
      skills: ['retenção', 'churn', 'win-back'],
      system_prompt: 'Você é o especialista em retenção. Para clientes em risco de churn, identifique as causas da insatisfação, proponha soluções (desconto, suporte dedicado, features), e execute o plano de retenção. Cada cliente retido é uma vitória.'
    },
    {
      name: 'Upseller',
      specialty: 'sales',
      step_label: 'Upsell/Cross-sell',
      step_description: 'Identifica oportunidades de expansão e upsell em clientes satisfeitos',
      position: 3,
      is_optional: true,
      skills: ['upsell', 'cross-sell', 'expansion'],
      system_prompt: 'Você é o especialista em expansão. Para clientes satisfeitos e engajados, identifique oportunidades de upsell (upgrade de plano) ou cross-sell (produtos complementares). Apresente os benefícios de forma consultiva, sem ser agressivo.'
    }
  ]
}
```

---

## 11. REFERÊNCIAS DE CÓDIGO EXISTENTE

Ao implementar, siga os padrões exatos destes arquivos existentes:

| Padrão | Arquivo de Referência |
|--------|----------------------|
| Layout de página com header, tabs, grid | `src/pages/Agents.tsx` |
| Visualização ReactFlow | `src/components/agents/AgentFlowPipeline.tsx` |
| Canvas ReactFlow interativo | `src/components/flow-builder/FlowBuilderCanvas.tsx` |
| Dialog de criação conversacional | `src/components/agents/SkillAgentDialog.tsx` |
| Página de config via chat | `src/pages/AIConfigurator.tsx` |
| Hook CRUD com React Query | `src/hooks/useAgents.ts` |
| Edge function com CORS + Supabase | `supabase/functions/orchestrator/index.ts` |
| Edge function com tool calling IA | `supabase/functions/skill-agent-creator/index.ts` |
| Geração de fluxo via IA | `supabase/functions/flow-ai-builder/index.ts` |
| Pipeline de execução multi-step | `supabase/functions/process-incoming-message/index.ts` |
| Componente card de agente | `src/components/agents/AgentListCard.tsx` |
| Templates pré-configurados | `src/components/agents/AgentTemplates.tsx` |
| Dialog de formulário com tabs | `src/components/agents/AgentFormDialog.tsx` |

---

## 12. RESTRIÇÕES TÉCNICAS

- Usar React 18 + TypeScript + Vite
- Usar TailwindCSS + shadcn/ui (Radix UI) para TODOS os componentes UI
- Usar TanStack React Query v5 para estado do servidor
- Usar React Router v6 para roteamento
- Usar ReactFlow (já instalado, `import ReactFlow from 'reactflow'`)
- Usar Supabase client de `@/integrations/supabase/client`
- Usar `import { toast } from 'sonner'` para notificações
- Usar `import { cn } from '@/lib/utils'` para merge de classes CSS
- Usar lucide-react para TODOS os ícones
- Edge functions usam Deno com `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"`
- Edge functions DEVEM incluir `corsHeaders` e tratar requisição OPTIONS (preflight CORS)
- TODOS os textos em Português Brasileiro
- Não editar `src/integrations/supabase/types.ts` manualmente (é auto-gerado)
- Manter padrão dark/light via CSS variables

---

## 13. SEQUÊNCIA DE IMPLEMENTAÇÃO SUGERIDA

Se precisar dividir em estágios:

1. **Fundação:** Tabelas SQL + tipos + hook `useSquads` + página Squads com estado vazio
2. **Componentes UI:** SquadCard, SquadFlowCanvas, SquadFormDialog, SquadMemberRow
3. **Fluxo Visual:** SquadFlowCanvas completo com custom nodes, edges e minimap
4. **Builder Conversacional:** SquadBuilderDialog + edge function `squad-builder`
5. **Motor de Execução:** Edge function `squad-executor` + atualizações no orchestrator e process-incoming-message
6. **Playground:** Página SquadPlayground com execução em tempo real
7. **Integração AIConfigurator:** Adicionar contexto 'squad' na página existente
