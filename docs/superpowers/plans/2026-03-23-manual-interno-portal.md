# Portal de Manuais Internos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Intercom-style internal manual portal at `/manual` for system users, with module grid home + step-by-step article viewer.

**Architecture:** Two new pages (ManualHome, ManualArticleViewer) with 6 supporting components under `src/components/manual/`. One custom hook queries `ai_knowledge_base` filtered by `category='manual'`. HTML content is parsed into steps by splitting on headings. DOMPurify sanitizes all rendered HTML content.

**Tech Stack:** React 18 + TypeScript, TailwindCSS + shadcn/ui, React Query v5, Supabase client, lucide-react icons, DOMPurify

**Spec:** `docs/superpowers/specs/2026-03-23-manual-interno-portal-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/hooks/useManualArticles.ts` | Hook: fetch manual articles + products, search, filter |
| `src/lib/parseSteps.ts` | Utility: parse HTML content into step objects |
| `src/pages/ManualHome.tsx` | Page: hero + module grid + article list |
| `src/pages/ManualArticleViewer.tsx` | Page: step-by-step article viewer |
| `src/components/manual/ManualModuleCard.tsx` | Card for module in grid |
| `src/components/manual/ManualArticleCard.tsx` | Article list item card |
| `src/components/manual/ManualStepBlock.tsx` | Single step block with number + content |
| `src/components/manual/ManualProgressBar.tsx` | Sticky progress bar |
| `src/components/manual/ManualTableOfContents.tsx` | Right sidebar TOC |
| `src/components/manual/ManualSearchBar.tsx` | Search input with debounce |

### Modified Files
| File | Change |
|------|--------|
| `src/App.tsx` | Add lazy imports + routes for `/manual` and `/manual/:id` |
| `src/components/layout/Sidebar.tsx` | Add "Manuais" nav item with BookOpen icon |

---

## Task 1: Install DOMPurify

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install DOMPurify + types**

```bash
npm install dompurify && npm install -D @types/dompurify
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add dompurify for HTML sanitization in manual viewer"
```

---

## Task 2: Step Parser Utility

**Files:**
- Create: `src/lib/parseSteps.ts`

- [ ] **Step 1: Create parseSteps utility**

The utility exports three functions:
- `parseSteps(html)` — splits HTML into `Step[]` by h2/h3 headings, returns null if no headings (fallback)
- `countSteps(html)` — counts headings without full parse (for badges)
- `estimateReadingTime(html)` — word count / 200, min 1 minute

Parsing priority: `<h2>` first, then `<h3>`, then markdown `## `. Requires at least 2 headings to split into steps.

Each Step has `{ title: string, content: string }` where title is the heading text (tags stripped) and content is everything between this heading and the next.

- [ ] **Step 2: Commit**

```bash
git add src/lib/parseSteps.ts
git commit -m "feat(manual): add step parser utility for HTML content"
```

---

## Task 3: Data Hook — useManualArticles

**Files:**
- Create: `src/hooks/useManualArticles.ts`

- [ ] **Step 1: Create the hook**

Three exports:
- `useManualArticles({ productId?, search? })` — queries `ai_knowledge_base` WHERE `category='manual'` AND `is_active=true`, ordered by `title`. Joins `knowledge_products` for module name/color/icon. Returns `{ articles, products (with counts), isLoading, error, refetch }`.
- `useManualArticle(id)` — single article query by ID.
- `useManualFeedback()` — mutation that increments `helpful_count` or `not_helpful_count` on `ai_knowledge_base`, invalidates article query.

Search uses Supabase `ilike` on title and description.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useManualArticles.ts
git commit -m "feat(manual): add useManualArticles hook with search and feedback"
```

---

## Task 4: UI Components

**Files:**
- Create: `src/components/manual/ManualSearchBar.tsx`
- Create: `src/components/manual/ManualModuleCard.tsx`
- Create: `src/components/manual/ManualArticleCard.tsx`
- Create: `src/components/manual/ManualStepBlock.tsx`
- Create: `src/components/manual/ManualProgressBar.tsx`
- Create: `src/components/manual/ManualTableOfContents.tsx`

- [ ] **Step 1: Create ManualSearchBar**

Input with Search icon, debounced onChange (300ms). White background, rounded-xl, shadow-lg. Max-width 500px.

- [ ] **Step 2: Create ManualModuleCard**

Button card showing icon (from lucide-react icon map), module name, article count. Active state: cyan border + E8F9F9 bg + cyan shadow. Inactive: hover translateY(-0.5) + shadow.

- [ ] **Step 3: Create ManualArticleCard**

Link to `/manual/:id`. Shows FileText icon, title (15px semibold), truncated description, product badge, step count badge (from `countSteps`), difficulty badge (from tags array), ChevronRight. Hover: bg gray-100 + cyan left border.

Difficulty derived from `tags[]`: look for "iniciante", "intermediario", or "avancado". Color-coded badges (green/yellow/red).

- [ ] **Step 4: Create ManualStepBlock**

ForwardRef component. Shows step number in 40px cyan circle, title, HTML content sanitized with DOMPurify. Connected by dashed vertical line. Active step: full opacity + cyan shadow on number. Inactive: opacity 0.6.

Images styled with rounded-lg, shadow-md, border.

- [ ] **Step 5: Create ManualProgressBar**

Sticky top-0 z-50 bar. Shows article title + "Passo X de Y". Progress bar: gray-200 bg, cyan fill, smooth width transition.

- [ ] **Step 6: Create ManualTableOfContents**

220px sidebar, hidden on mobile (lg:block). Sticky top-20. Lists steps with small numbered circles. Active step: E8F9F9 bg, semibold. Click scrolls to step.

- [ ] **Step 7: Commit all components**

```bash
git add src/components/manual/
git commit -m "feat(manual): add UI components for manual portal"
```

---

## Task 5: ManualHome Page

**Files:**
- Create: `src/pages/ManualHome.tsx`

- [ ] **Step 1: Create ManualHome page**

Layout (top to bottom):
1. **Hero** (navy bg): BookOpen icon + "Central de Manuais" title + subtitle + ManualSearchBar
2. **Module Grid** (4 cols desktop, 3 tablet, 2 mobile): ManualModuleCard per product. Click toggles filter.
3. **Filter chip**: "Limpar filtro" button when module selected
4. **Article list**: ManualArticleCard per article. Header shows count and context.

States:
- Loading: skeleton cards (8 in grid, 4 in list)
- Error: AlertCircle + "Erro ao carregar manuais" + "Tentar novamente" button
- Empty: BookOpen icon + "Nenhum manual disponível ainda"
- Search no results: message + "Limpar busca" link

- [ ] **Step 2: Commit**

```bash
git add src/pages/ManualHome.tsx
git commit -m "feat(manual): add ManualHome page with hero, module grid, article list"
```

---

## Task 6: ManualArticleViewer Page

**Files:**
- Create: `src/pages/ManualArticleViewer.tsx`

- [ ] **Step 1: Create ManualArticleViewer page**

Layout:
1. **ManualProgressBar** (sticky, only if steps exist)
2. **Breadcrumb**: Manuais > [Module] > [Title]
3. **Header**: title (Poppins 22px bold), badges (module, difficulty, step count, reading time)
4. **Steps or fallback**: If parseSteps returns steps, render ManualStepBlock list with IntersectionObserver tracking active step. If null, render sanitized HTML as continuous article.
5. **Feedback**: "Este artigo foi útil?" with ThumbsUp/ThumbsDown. localStorage dedup. Animated thank-you.
6. **Prev/Next**: Cards linking to sibling articles (same product_id, ordered by title ASC).
7. **ManualTableOfContents** sidebar (right, only if steps)

States:
- Loading: Spinner centered
- Error: AlertCircle + link back to /manual
- 404: "Artigo não encontrado" + link back

- [ ] **Step 2: Commit**

```bash
git add src/pages/ManualArticleViewer.tsx
git commit -m "feat(manual): add ManualArticleViewer with step-by-step, progress, TOC, feedback"
```

---

## Task 7: Register Routes and Sidebar Item

**Files:**
- Modify: `src/App.tsx` (~line 79 for imports, ~line 165 for routes)
- Modify: `src/components/layout/Sidebar.tsx` (~line 66 for nav items, imports for BookOpen)

- [ ] **Step 1: Add lazy imports in App.tsx**

After CancellationDashboard import (line 79):
```typescript
const ManualHome = lazy(() => import("./pages/ManualHome"))
const ManualArticleViewer = lazy(() => import("./pages/ManualArticleViewer"))
```

- [ ] **Step 2: Add routes in App.tsx**

Before the `/help/manuals` routes (~line 165):
```tsx
<Route path="/manual" element={<ManualHome />} />
<Route path="/manual/:id" element={<ManualArticleViewer />} />
```

- [ ] **Step 3: Add sidebar item in Sidebar.tsx**

Add `BookOpen` to the lucide-react import. Add new category before 'Sistema' (before line 108):
```typescript
{
  category: 'Aprendizado',
  items: [
    { icon: BookOpen, label: 'Manuais', path: '/manual' },
  ],
},
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(manual): register /manual routes and sidebar nav item"
```

---

## Task 8: Verify & Polish

- [ ] **Step 1: Run dev server and verify pages**

```bash
npm run dev
```

Check `/manual`: hero, search, module grid, article list, loading states, empty states.
Check `/manual/:id`: steps, progress bar, TOC, feedback, prev/next.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Fix any issues.

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: Clean build with no errors.

- [ ] **Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(manual): address lint and build issues"
```
