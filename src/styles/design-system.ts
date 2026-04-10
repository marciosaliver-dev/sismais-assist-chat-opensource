/**
 * SisCRM – Design System v2.0
 *
 * Fonte de verdade para tokens de design.
 * As CSS variables estão definidas em src/index.css
 * e mapeadas no tailwind.config.ts.
 *
 * USO:
 *   - Em componentes Tailwind, use as classes semânticas:
 *       bg-primary, text-foreground, border-border, bg-ai-soft, etc.
 *   - Para valores programáticos (charts, canvas, etc.), importe deste arquivo.
 */

// ── Paleta de Cores ──────────────────────────────────────────────
export const colors = {
  primary: {
    DEFAULT: '#45e5e5',
    dark: '#38d1d1',
    hsl: '180 74% 58%',
    hslDark: '180 58% 52%',
  },
  background: {
    DEFAULT: '#F9FBFC',
    hsl: '210 33% 98%',
  },
  card: {
    DEFAULT: '#FFFFFF',
    hsl: '0 0% 100%',
  },
  border: {
    light: '#E2E8F0',
    hsl: '214 32% 91%',
  },
  text: {
    main: '#1e293b',
    mainHsl: '222 47% 17%',
    muted: '#64748b',
    mutedHsl: '215 16% 47%',
  },
  ai: {
    soft: '#f0fdff',
    softHsl: '187 100% 97%',
  },
  accent: {
    blue: '#f0f9ff',
    blueHsl: '204 100% 97%',
  },
  status: {
    success: '#2f9e6e',
    warning: '#f59e0b',
    destructive: '#ef4444',
  },
  whatsapp: {
    DEFAULT: '#22c55e',
    light: '#f0fdf4',
  },
  copilot: {
    DEFAULT: '#7c3aed',
    light: '#f5f3ff',
  },
} as const

// ── Tipografia ───────────────────────────────────────────────────
export const typography = {
  fontDisplay: "'Poppins', 'Inter', system-ui, sans-serif",
  fontSans: "'Inter', system-ui, sans-serif",
  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const

// ── Border Radius ────────────────────────────────────────────────
export const radii = {
  sm: '6px',    // calc(0.625rem - 4px)
  md: '8px',    // calc(0.625rem - 2px)
  lg: '10px',   // 0.625rem (--radius)
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
} as const

// ── Sombras ──────────────────────────────────────────────────────
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
} as const

// ── Layout ───────────────────────────────────────────────────────
export const layout = {
  headerHeight: '64px',
  sidebarWidth: '256px',
  sidebarCollapsed: '64px',
  maxContentWidth: '1400px',
} as const

// ── Mapeamento CSS Variable → Tailwind Class ────────────────────
// Referência rápida para devs:
//
// | Token              | CSS Variable          | Tailwind Class         |
// |--------------------|-----------------------|------------------------|
// | Primary            | --primary             | bg-primary, text-primary |
// | Primary Dark       | --primary-dark        | bg-primary-dark        |
// | Background         | --background          | bg-background          |
// | Card               | --card                | bg-card                |
// | Border             | --border              | border-border          |
// | Text Main          | --foreground          | text-foreground        |
// | Text Muted         | --muted-foreground    | text-muted-foreground  |
// | AI Soft            | --ai-soft             | bg-ai-soft             |
// | Accent Blue        | --accent              | bg-accent              |
// | Success            | --success             | text-success           |
// | Warning            | --warning             | text-warning           |
// | Destructive        | --destructive         | text-destructive       |
// | WhatsApp           | --whatsapp            | bg-whatsapp            |
// | Copilot            | --copilot             | bg-copilot             |
