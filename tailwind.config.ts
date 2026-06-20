import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // 2B Supply brand palette — derived from the logo (cyan -> blue).
        // `brand` (DEFAULT) keeps every existing `bg-brand`/`text-brand` working;
        // `brand-cyan`/`brand-blue` expose the two gradient stops directly.
        brand: {
          DEFAULT: '#0e8de1',
          cyan: '#0ed1e0',
          blue: '#0e8de1',
          dark: '#0a6fbf',
        },
        // Material You (Material Design 3) tokens — light mode only for now.
        // Palette derived from the 2B Supply brand seed `#0ed1e0` (bright cyan)
        // using the MD3 HCT tonal scale. Primary lives at tone 40 (accessible
        // on light surfaces); the pure brand cyan stays available as `bg-brand`
        // / `text-brand` for highlight spans.
        md: {
          background: '#FAFDFD',
          foreground: '#191C1D',
          primary: '#006874',
          'on-primary': '#FFFFFF',
          'primary-container': '#97F0FF',
          'on-primary-container': '#001F24',
          secondary: '#4A6266',
          'on-secondary': '#FFFFFF',
          'secondary-container': '#CCE7EC',
          'on-secondary-container': '#051F23',
          tertiary: '#525E7D',
          'on-tertiary': '#FFFFFF',
          'tertiary-container': '#DAE2FF',
          'on-tertiary-container': '#0E1B37',
          'surface-container': '#E5EDEE',
          'surface-container-low': '#EFF1F1',
          'surface-variant': '#DAE4E5',
          outline: '#6F7979',
          'outline-variant': '#BEC8C9',
          'on-surface-variant': '#3F484A',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Material You scale — generous, organic curves.
        'md-xs': '8px',
        'md-sm': '12px',
        'md-md': '16px',
        'md-lg': '24px',
        'md-xl': '28px',
        'md-xxl': '32px',
        'md-hero': '48px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // 2B Supply brand typeface — used on landing and any MD3-styled page.
        outfit: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        // Material You's "Emphasized Decelerate" — confident, never bouncy.
        'md-standard': 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [animate, typography],
};

export default config;
