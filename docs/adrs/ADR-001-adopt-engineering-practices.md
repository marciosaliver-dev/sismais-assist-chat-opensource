# ADR-001: Adotar práticas de engenharia Anthropic + Google

**Status:** Accepted
**Data:** 2026-03-23
**Autor:** Marcio S.

## Context

O SisCRM cresceu organicamente com foco em features, mas acumulou gaps em práticas de engenharia: zero cobertura de testes, sem monitoramento, TypeScript permissivo, e processo de review informal. Para escalar com qualidade, precisamos adotar práticas maduras.

## Decision

Adotar um subset prático das práticas de engenharia da Anthropic e Google:

### Da Anthropic
1. **CLAUDE.md como infraestrutura** (já fazemos ✅)
2. **REVIEW.md** para guiar code reviews
3. **Multi-agent parallel development** para features desacopladas
4. **TDD + E2E** como padrão de testes

### Do Google
1. **PRs < 300 linhas** com review obrigatório via CODEOWNERS
2. **Design docs** para features > 3 dias
3. **Trunk-based development** com CI gate
4. **Pirâmide de testes** (80% unit, 15% integration, 5% E2E)
5. **SLOs com Error Budget** (3 métricas iniciais)
6. **Postmortems blameless** para todo incidente P0/P1
7. **20% do sprint** alocado para tech debt

### TypeScript Strictness Roadmap
1. Fase 1: `strictNullChecks: true`
2. Fase 2: `noUnusedLocals: true`
3. Fase 3: Reduzir `any` para < 200 ocorrências

## Consequences

- **Positivo:** Menos bugs em produção, deploys mais seguros, onboarding mais fácil
- **Negativo:** Overhead inicial de ~15% na velocidade de delivery (recuperado em 4-6 semanas)
- **Risco:** Equipe pode resistir ao processo extra — mitigar com rollout gradual

## Alternatives Considered

1. **Manter status quo** — rejeitado, debt cresce exponencialmente
2. **Adotar tudo de uma vez** — rejeitado, muito disruptivo
3. **Adotar gradualmente por sprints** — escolhido ✅
