# TV Dashboard v2 — Design Spec

**Data:** 2026-03-26
**Autor:** Claude (Sonnet 4.6)
**Status:** Aprovado para implementação

---

## Contexto

O TV Dashboard atual (`/tv`) é uma tela única estática com 4 componentes side-by-side: KPI strip no topo, fila por board (60% esquerda), ranking de agentes (40% direita) e stale tickets no rodapé. Não há navegação entre views, a experiência visual é funcional mas básica, e o layout desperdiça espaço em TVs wide.

**Objetivo:** Elevar o TV Dashboard ao padrão de ferramentas como Google SRE Boards, Meta Ops Dashboards e Vercel Speed Insights — com navegação automática entre múltiplas views, transições suaves, alertas críticos sempre visíveis e excelente legibilidade em TVs.

---

## Arquitetura

```
TVDashboard.tsx (orquestrador)
  ├── useTVDashboardMetrics()     ← hook existente, sem modificação
  ├── useTVAutoRotation()         ← NOVO hook
  ├── TVNavBar                    ← NOVO componente (substitui TVKPIStrip)
  └── views com fade+slide transition
       ├── TVOverviewView          ← NOVO (refatora layout atual)
       ├── TVQueueView             ← NOVO (usa TVQueuePanel + TVStaleTickets)
       ├── TVPerformanceView       ← NOVO (usa TVAgentRanking)
       └── TVSLAView               ← NOVO (usa staleTickets)
```

---

## Hook: `useTVAutoRotation`

```ts
// Responsabilidade: gerenciar qual view está ativa e a rotação automática
interface UseTVAutoRotationReturn {
  currentView: number           // 0-3
  setView: (i: number) => void  // pausa 60s e muda para a view
  isPaused: boolean             // se está em pausa manual
  progress: number              // 0-100, percentual do timer atual
}
```

**Comportamento:**
- Avança de view a cada 20s automaticamente
- Ao clicar em tab: pausa por 60s, depois retoma do próximo
- Reseta o timer de progresso a cada troca de view
- Usa `useEffect` cleanup para evitar memory leaks

---

## Componente: `TVNavBar`

Substitui `TVKPIStrip`. Contém:

1. **Logo GMS** — badge cyan com "GMS" + label "TV Dashboard"
2. **Tabs de navegação** — 4 tabs com ícones Material Symbols:
   - `dashboard` → Visão Geral
   - `pending_actions` → Fila Ao Vivo
   - `leaderboard` → Performance
   - `monitor_heart` → SLA
3. **Barra de progresso** — linha cyan na borda inferior do nav, animação CSS linear 20s
4. **Indicador "AO VIVO"** — dot verde pulsante
5. **Relógio** — hora HH:MM:SS + data

**Altura:** 64px
**Background:** `#0d2237` (navy mais escuro que o body para separação visual)

---

## Banner de Alerta Crítico (sempre visível)

Se houver tickets com `staleMinutes > 60`:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠ ALERTA SLA — N tickets aguardando há mais de 1h        │
└──────────────────────────────────────────────────────────┘
```

- Background: `rgba(220,38,38,0.15)` com `border-bottom: 2px solid #DC2626`
- Animação: `animate-pulse` no ícone
- Altura: 36px
- Aparece entre NavBar e as views — empurra o conteúdo para baixo

---

## Views

### View 0 — Visão Geral

Layout bento grid (12 colunas):
- **col-span-4 × 3**: Hero KPIs — Na Fila, Em Atendimento, Resolvidos Hoje (números grandes 80px+)
- **col-span-8**: Grid de boards com barras de progresso waiting/inProgress
- **col-span-4**: Mini-ranking top 3 agentes do dia

### View 1 — Fila Ao Vivo

Layout split:
- **Esquerda 40%**: Lista de stale tickets ordenados por tempo (>30min), com timer e severidade
- **Direita 60%**: Gráfico de barras "Fluxo por Hora" (últimas 7h) + indicadores de saúde dos canais (WhatsApp, Chat)

### View 2 — Performance de Agentes

Layout:
- **Top performer card (col-span-7)**: Nome, avatar inicial, CSAT, TMA, resolvidos, com background gradient navy→cyan sutil
- **Ranking completo (col-span-5)**: Lista com posição, nome, barra de progresso proporcional, CSAT
- **Rodapé**: Ticker de eventos recentes (últimas ações de agentes)

### View 3 — Monitoramento SLA

Layout:
- **Hero**: % de SLA cumprido hoje (círculo/donut visual)
- **Tabela de violações**: Tickets com tempo de espera em vermelho/laranja
- **Por board**: SLA compliance por board em mini-cards

---

## Transições entre Views

```css
/* Entrada */
@keyframes viewEnter {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Saída (aplicada na view que sai) */
@keyframes viewExit {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-16px); }
}
```

**Duração:** 300ms `ease-out`

**Acessibilidade:**
```css
@media (prefers-reduced-motion: reduce) {
  /* Apenas fade, sem transform */
}
```

---

## Ticker Bar (Rodapé)

- Altura: 40px
- Background: `rgba(0,0,0,0.3)`
- Conteúdo: eventos reais do Supabase (últimas mudanças de status de tickets)
- Animação: CSS `marquee` — scroll horizontal contínuo, pausado no hover

---

## Padrões Big Tech Aplicados

| Padrão | Origem | Aplicação |
|--------|--------|-----------|
| Auto-rotation com pause-on-interact | Google DataStudio | Click em tab pausa 60s |
| Critical alert always-on-top | Meta Ads Manager | Banner vermelho fixo quando SLA violado |
| `prefers-reduced-motion` | WCAG / Apple | Transitions sem transform se ativado |
| Bento grid layout | Linear, Vercel | Views organizadas em grid 12-col |
| Live indicator pulsante | Bloomberg Terminal | Dot verde no nav indicando dados ao vivo |
| Ticker de eventos | Bloomberg / Reuters | Rodapé com eventos recentes |
| Progress timer visual | Google Meet / Figma | Barra linear mostrando tempo até próxima view |

---

## Arquivos

### Novos
- `src/hooks/useTVAutoRotation.ts`
- `src/components/tv-dashboard/TVNavBar.tsx`
- `src/components/tv-dashboard/TVOverviewView.tsx`
- `src/components/tv-dashboard/TVQueueView.tsx`
- `src/components/tv-dashboard/TVPerformanceView.tsx`
- `src/components/tv-dashboard/TVSLAView.tsx`

### Modificados
- `src/pages/TVDashboard.tsx` — reescrito como orquestrador de views
- `src/components/tv-dashboard/TVQueuePanel.tsx` — absorvido pelo TVQueueView
- `src/components/tv-dashboard/TVAgentRanking.tsx` — absorvido pelo TVPerformanceView
- `src/components/tv-dashboard/TVStaleTickets.tsx` — absorvido pelo TVSLAView
- `src/components/tv-dashboard/TVKPIStrip.tsx` — substituído pelo TVNavBar

---

## Verificação

1. Abrir `/tv` → confirmar carregamento com spinner GMS
2. Aguardar 20s → view muda automaticamente com transição suave
3. Clicar em tab "Performance" → vai para view, progresso reseta, retoma após 60s de inatividade
4. Simular ticket com staleMinutes > 60 → banner vermelho aparece em todas as views
5. Ativar `prefers-reduced-motion: reduce` → transições sem transform
6. Testar em resolução 1920×1080 e 3840×2160 (4K) → layout não quebra
