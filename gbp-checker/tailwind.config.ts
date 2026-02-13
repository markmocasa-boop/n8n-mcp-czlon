import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: {
          DEFAULT: '#111113',
          light: '#1A1A1E',
        },
        border: {
          DEFAULT: '#1F1F23',
          light: '#2A2A30',
        },
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          light: '#3B82F6/10',
        },
        score: {
          good: '#22C55E',
          medium: '#F59E0B',
          bad: '#EF4444',
        },
        text: {
          DEFAULT: '#FAFAFA',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
export default config
