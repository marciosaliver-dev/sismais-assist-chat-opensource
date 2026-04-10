import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontSize: {
        xs:   ['0.8125rem', { lineHeight: '1.125rem' }],   // 13px (GMS)
        sm:   ['0.9375rem', { lineHeight: '1.375rem' }],   // 15px (GMS)
        base: ['1.0625rem', { lineHeight: '1.5rem' }],     // 17px (GMS)
        lg:   ['1.25rem',   { lineHeight: '1.75rem' }],    // 20px (GMS)
        xl:   ['1.375rem',  { lineHeight: '1.875rem' }],   // 22px (GMS)
        '2xl': ['1.625rem', { lineHeight: '2.125rem' }],   // 26px (GMS)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          dark: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        whatsapp: {
          DEFAULT: "hsl(var(--whatsapp))",
          light: "hsl(var(--whatsapp-light))",
        },
        copilot: {
          DEFAULT: "hsl(var(--copilot))",
          light: "hsl(var(--copilot-light))",
          foreground: "hsl(var(--copilot-foreground))",
        },
        ai: {
          soft: "hsl(var(--ai-soft))",
        },
        gms: {
          navy: 'var(--gms-navy)',
          'navy-hover': 'var(--gms-navy-hover)',
          'navy-light': 'var(--gms-navy-light)',
          cyan: 'var(--gms-cyan)',
          'cyan-hover': 'var(--gms-cyan-hover)',
          'cyan-dark': 'var(--gms-cyan-dark)',
          'cyan-light': 'var(--gms-cyan-light)',
          yellow: 'var(--gms-yellow)',
          'yellow-hover': 'var(--gms-yellow-hover)',
          'yellow-bg': 'var(--gms-yellow-bg)',
          g100: 'var(--gms-g100)',
          g200: 'var(--gms-g200)',
          g300: 'var(--gms-g300)',
          g500: 'var(--gms-g500)',
          g700: 'var(--gms-g700)',
          g900: 'var(--gms-g900)',
          ok: 'var(--gms-ok)',
          'ok-bg': 'var(--gms-ok-bg)',
          err: 'var(--gms-err)',
          'err-bg': 'var(--gms-err-bg)',
          warn: 'var(--gms-warn)',
          'warn-bg': 'var(--gms-warn-bg)',
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(16,41,63,0.06)",
        md: "0 4px 6px -1px rgba(16,41,63,0.1), 0 2px 4px -1px rgba(16,41,63,0.06)",
        lg: "0 10px 15px -3px rgba(16,41,63,0.1), 0 4px 6px -2px rgba(16,41,63,0.05)",
        cyan: "0 4px 14px rgba(69,229,229,0.3)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "unread-pulse": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(234,88,12,0)" },
          "50%": { opacity: "0.96", boxShadow: "0 0 6px 1px rgba(234,88,12,0.12)" },
        },
        "cnpj-alert": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(220,38,38,0)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 12px 4px rgba(220,38,38,0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "unread-pulse": "unread-pulse 5s ease-in-out infinite",
        "cnpj-alert": "cnpj-alert 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
