/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      colors: {
        at: {
          bg:        '#0A0A0A',
          surface:   '#151515',
          elevated:  '#1C1C1C',
          subtle:    '#111111',
          accent:       '#D62828',
          'accent-hover': '#A31D1D',
          'accent-muted': 'rgba(214, 40, 40, 0.10)',
          text:       '#F5F5F5',
          'text-secondary': '#DEDEDE',
          muted:      '#999999',
          disabled:   '#555555',
          border:        'rgba(255, 255, 255, 0.06)',
          'border-hover': 'rgba(255, 255, 255, 0.12)',
          'border-active': 'rgba(214, 40, 40, 0.4)',
        },
        sev: {
          low:      '#22C55E',
          medium:   '#EAB308',
          high:     '#F97316',
          critical: '#EF4444',
          info:     '#60A5FA',
        },
        st: {
          online:  '#22C55E',
          offline: '#6B7280',
          warning: '#EAB308',
          error:   '#EF4444',
        },
      },
      borderRadius: {
        'card': '14px',
        'btn': '10px',
        'input': '10px',
        'badge': '6px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-left': 'slideLeft 0.25s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
