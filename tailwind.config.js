/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-dependent surfaces/text — backed by CSS variables that swap
        // between the dark and light palettes (see src/index.css).
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
        // Conceptual accent colors — identical on both themes.
        fbs: { function: '#3B82F6', behaviour: '#22C55E', structure: '#8B5CF6' },
        agent: {
          orchestrator: '#F59E0B',
          retrieval: '#06B6D4',
          generation: '#EC4899',
          simulation: '#6366F1',
          documentation: '#84CC16',
          dfx: '#10B981',
        },
        dfs: '#10B981',
        human: '#3B82F6',
        ai: 'rgb(var(--text-secondary) / <alpha-value>)',
        status: {
          pass: '#22C55E',
          redesign: '#EF4444',
          warning: '#F59E0B',
          simulated: '#64748B',
          running: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        caption: ['11px', '15px'],
        body: ['13px', '18px'],
        section: ['15px', '20px'],
        screen: ['20px', '26px'],
      },
      maxWidth: { app: '1600px' },
      keyframes: {
        'gauge-fill': { from: { width: '0%' }, to: {} },
        pulsering: {
          '0%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.5)' },
          '70%': { boxShadow: '0 0 0 8px rgba(59,130,246,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
        },
        'pulse-amber': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(245,158,11,0.35)' },
        },
        fadein: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'dash-flow': { to: { strokeDashoffset: '-16' } },
      },
      animation: {
        pulsering: 'pulsering 1.2s ease-out infinite',
        'pulse-amber': 'pulse-amber 1s ease-in-out infinite',
        fadein: 'fadein 0.4s ease-out',
        shimmer: 'shimmer 1.5s infinite',
        'dash-flow': 'dash-flow 0.6s linear infinite',
      },
    },
  },
  plugins: [],
};
