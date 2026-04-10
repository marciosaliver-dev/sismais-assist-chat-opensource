# Sismais Assist Chat 💬

**Helpdesk via WhatsApp com IA multi-agente — open source**

Plataforma completa de atendimento ao cliente integrada ao WhatsApp. Combina agentes de IA com suporte humano, automações, base de conhecimento com busca semântica (RAG) e quadro Kanban para gestão de tickets.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)

---

## O que é?

Uma plataforma que transforma o WhatsApp da sua empresa em um sistema de atendimento profissional com IA. Você configura agentes que respondem automaticamente, e quando a IA não sabe responder, transfere para um atendente humano.

**Desenvolvido originalmente pela [Sismais Tecnologia](https://sismais.com) e disponibilizado como open source.**

---

## Funcionalidades

- ✅ **Atendimento via WhatsApp** — integração com UAZAPI
- ✅ **Agentes de IA multi-papel** — triagem, suporte, financeiro, vendas, copiloto
- ✅ **Base de conhecimento com RAG** — busca semântica em documentos
- ✅ **Orquestrador inteligente** — decide automaticamente qual agente responde
- ✅ **Kanban de tickets** — gestão visual com drag-and-drop
- ✅ **Fila de atendimento** — controle de conversas em espera
- ✅ **Automações** — regras automáticas por gatilho
- ✅ **Construtor de fluxos** — editor visual de fluxos de conversa
- ✅ **Campanhas proativas** — envio em massa para contatos
- ✅ **Dashboard de consumo de IA** — controle de custos por token
- ✅ **Configurador de IA conversacional** — configura o sistema via chat

---

## Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | TailwindCSS + shadcn/ui |
| Backend / Banco | Supabase (PostgreSQL + RLS) |
| Edge Functions | Deno (TypeScript) — 44 funções |
| IA / LLM | OpenRouter (modelos configuráveis) |
| Embeddings | OpenAI (busca semântica) |
| WhatsApp | UAZAPI |

---

## Pré-requisitos

Antes de instalar, você vai precisar criar contas nos seguintes serviços:

| Serviço | Gratuito? | Para que serve | Link |
|---------|-----------|---------------|------|
| [Supabase](https://supabase.com) | ✅ Sim | Banco de dados e backend | [supabase.com](https://supabase.com) |
| [OpenRouter](https://openrouter.ai) | 💳 Pago por uso | Motor de IA (LLM) | [openrouter.ai](https://openrouter.ai) |
| [OpenAI](https://platform.openai.com) | 💳 Pago por uso | Embeddings para busca semântica | [platform.openai.com](https://platform.openai.com) |
| [UAZAPI](https://uazapi.com) | 💳 Pago | Integração WhatsApp | [uazapi.com](https://uazapi.com) |

> **Dica:** Para testar sem gastar, comece apenas com o Supabase (gratuito). A IA e o WhatsApp podem ser configurados depois.

---

## Instalação passo a passo

### 1. Clone o repositório

```bash
git clone https://github.com/marciosaliver-dev/sismais-assist-chat-opensource.git
cd sismais-assist-chat-opensource
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Abra o .env e preencha com seus dados
# (veja instruções dentro do arquivo)
```

**Variáveis obrigatórias no `.env`:**

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-aqui
```

> Como obter: acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard) → Project Settings → API

### 4. Configure as Edge Functions (Supabase Secrets)

No painel do Supabase, vá em **Edge Functions → Secrets** e adicione:

| Secret | Onde obter |
|--------|-----------|
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |
| `UAZAPI_BASE_URL` | Seu servidor UAZAPI |
| `UAZAPI_TOKEN` | Painel UAZAPI |

### 5. Execute as migrations do banco

```bash
npx supabase db push
```

> Você precisa ter o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado.

### 6. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

Na primeira vez sem o `.env` configurado, o **Setup Wizard** aparecerá automaticamente para guiar a configuração.

---

## Estrutura do projeto

```
src/
├── pages/              # 31 páginas da aplicação
├── components/         # Componentes React reutilizáveis
│   ├── agents/         # Gerenciamento de agentes IA
│   ├── inbox/          # Chat e conversas WhatsApp
│   ├── tickets/        # Kanban e tickets
│   ├── SetupWizard/    # Configuração inicial
│   └── ui/             # Componentes base (shadcn/ui)
├── hooks/              # Custom React hooks
├── integrations/
│   └── supabase/       # Cliente e tipos do Supabase
└── contexts/           # Contextos React (Auth, etc.)

supabase/
└── functions/          # 44 Edge Functions Deno
    ├── agent-executor/       # Executa agentes IA com RAG
    ├── orchestrator/         # Roteia mensagens para agentes
    ├── uazapi-webhook/       # Recebe webhooks WhatsApp
    ├── uazapi-proxy/         # Proxy para API UAZAPI
    └── ...
```

---

## Integrações opcionais (Sismais)

As seguintes Edge Functions são específicas para usuários dos sistemas **Sismais GL** e **Sismais Admin**. Se você não usa esses sistemas, ignore — o restante do projeto funciona normalmente sem elas.

- `sismais-admin-proxy` — Consulta clientes no Sismais Admin
- `sync-sismais-admin-clients` — Sincroniza base de clientes
- `sismais-client-lookup` — Busca clientes por CPF/CNPJ
- `sismais-client-auto-link` — Vincula clientes automaticamente
- `webhook-sismais-admin` — Webhooks do Sismais Admin

---

## Comandos úteis

```bash
npm run dev           # Inicia servidor de desenvolvimento
npm run build         # Build de produção
npm run lint          # Verificar erros de código
npm run test          # Rodar testes
```

---

## Contribuindo

Contribuições são muito bem-vindas! Veja o [CONTRIBUTING.md](CONTRIBUTING.md) para saber como participar.

---

## Licença

Este projeto está sob a licença [MIT](LICENSE).

Copyright (c) 2025 Sismais Tecnologia

---

## Créditos

Desenvolvido e open-sourcificado por [Sismais Tecnologia](https://sismais.com) — Bahia, Brasil 🇧🇷

> "Tornar a gestão MAIS SIMPLES, aproximando as pessoas da tecnologia."
