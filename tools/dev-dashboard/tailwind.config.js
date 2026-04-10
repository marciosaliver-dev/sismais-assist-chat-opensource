/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#10293F', hover: '#1a3d5c', light: '#1e3f5a' },
        cyan: { DEFAULT: '#45E5E5', hover: '#2ecece', dark: '#28a8a8', light: '#E8F9F9' },
        yellow: { DEFAULT: '#FFB800', hover: '#e6a600' },
        surface: { DEFAULT: '#1A2A3A', light: '#243444', border: '#2A3A4A' },
        bg: '#0F1923',
      }
    }
  },
  plugins: []
}
