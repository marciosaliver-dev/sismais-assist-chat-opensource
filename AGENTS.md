# Sismais Assist Chat — Helpdesk WhatsApp com IA

## Visão Geral

Plataforma de atendimento ao cliente com IA multi-agente integrada ao WhatsApp via UAZAPI. Combina agentes de IA com suporte humano, automações, RAG (base de conhecimento), orquestração inteligente e Kanban de tickets.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | TailwindCSS + shadcn/ui (Radix UI) |
| Estado servidor | TanStack React Query v5 |
| Roteamento | React Router v6 |
| Backend/DB | Supabase (PostgreSQL + RLS) |
| Edge Functions | Deno (TypeScript) — 44 funções |
| IA/LLM | OpenRouter (configurável) |
| Embeddings | OpenAI |
| WhatsApp | UAZAPI |

---

## Configuração

Copie `.env.example` para `.env` e preencha com suas credenciais.
Veja o [README.md](README.md) para o guia completo de instalação.

---

## Estrutura de Diretórios

```
src/
├── pages/              # Rotas da aplicação (31 páginas)
├── components/
│   ├── agents/         # Agentes IA
│   ├── inbox/          # Chat e conversas
│   ├── tickets/        # Kanban
│   ├── SetupWizard/    # Configuração inicial
│   └── ui/             # shadcn/ui base
├── hooks/              # Custom React hooks
├── integrations/supabase/
└── contexts/

supabase/
├── functions/          # 44 Edge Functions Deno
└── migrations/         # Migrations do banco
```

---

## Variáveis de Ambiente

**Frontend** (`.env`):
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon
```

**Edge Functions** (Supabase Secrets):
- `OPENROUTER_API_KEY` — LLM routing
- `OPENAI_API_KEY` — Embeddings
- `SUPABASE_SERVICE_ROLE_KEY` — Admin DB access
- `UAZAPI_BASE_URL`, `UAZAPI_TOKEN` — WhatsApp

---

## Padrões de Desenvolvimento

### Componentes React
- Componentes funcionais com TypeScript
- Queries via `useQuery` / mutations via `useMutation` (React Query)
- Toast via `import { toast } from 'sonner'`
- Ícones via `lucide-react`
- Classes CSS via `cn()` de `@/lib/utils`

### Supabase
- Cliente: `import { supabase } from '@/integrations/supabase/client'`
- Tipos: `import type { Tables } from '@/integrations/supabase/types'`
- Edge function: `supabase.functions.invoke('nome-da-funcao', { body: {...} })`

### Edge Functions (Deno)
- Sempre incluir `corsHeaders` no response
- Handler: `Deno.serve(async (req) => { ... })`
- Verificar `req.method === "OPTIONS"` para CORS preflight

### Git
- **NUNCA** commitar `.env` ou segredos
- Branch sugerida: `feat/nome-da-feature`
