# Design Doc: [Título da Feature]

**Autores:** [Nome]
**Status:** Draft | In Review | Approved | Implemented
**Última atualização:** YYYY-MM-DD
**Reviewers:** [Nomes]

---

## Overview

<!-- 3 frases: o que é, por que importa, qual o resultado esperado -->

## Context

<!-- Por que agora? Qual problema estamos resolvendo? Qual a motivação? -->

## Goals

- [ ] Goal 1
- [ ] Goal 2

## Non-Goals

<!-- Explicitamente o que NÃO está no escopo. Previne scope creep. -->

- Não vamos fazer X
- Não vamos mudar Y

## Design

### Arquitetura

<!-- Diagramas, fluxos de dados, componentes envolvidos -->

### Data Model

<!-- Tabelas novas/alteradas, campos, tipos, RLS policies -->

### API / Edge Functions

<!-- Endpoints novos/alterados, request/response format -->

### Frontend

<!-- Componentes, rotas, estado, interações -->

## Alternatives Considered

### Alternativa A: [Nome]

- **Pros:** ...
- **Cons:** ...
- **Por que não:** ...

### Alternativa B: [Nome]

- **Pros:** ...
- **Cons:** ...
- **Por que não:** ...

## Cross-Cutting Concerns

- **Segurança:** [RLS, auth, sanitização]
- **Performance:** [queries, caching, bundle size]
- **Observabilidade:** [logs, métricas, alertas]
- **Acessibilidade:** [WCAG, aria, contraste]

## Test Plan

- [ ] Unit tests para: ...
- [ ] Integration tests para: ...
- [ ] Manual testing: ...
- [ ] Edge cases: ...

## Rollout Plan

- [ ] Feature flag: `flag_name`
- [ ] Rollout: 10% → 50% → 100%
- [ ] Rollback plan: ...

## Open Questions

1. [Pergunta não resolvida]
2. [Decisão pendente]

## Timeline (estimativa)

| Fase | Duração | Dependências |
|------|---------|-------------|
| Design review | 2d | — |
| Implementação | Xd | Design approved |
| Testes | Xd | Implementação |
| Rollout | Xd | Testes passing |
