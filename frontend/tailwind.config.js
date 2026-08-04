/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        hud: {
          red: '#ef4444',
          crimson: '#dc2626',
          blood: '#b91c1c',
          ember: '#f87171',
          scarlet: '#fca5a5',
          danger: '#ef4444',
          success: '#f87171',
          warning: '#fbbf24',
          gold: '#fbbf24',
        },
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'spin-slower': 'spin 14s linear infinite',
        'spin-reverse': 'spin-reverse 10s linear infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'flicker': 'flicker 4s linear infinite',
        'scan': 'scan 4s ease-in-out infinite',
        'sweep': 'sweep 6s linear infinite',
        'fade-in': 'fade-in 0.6s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'data-stream': 'data-stream 12s linear infinite',
        'radar-sweep': 'radar-sweep 4s linear infinite',
        'blink': 'blink 1s step-end infinite',
        'glitch': 'glitch 0.3s ease-in-out',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.4)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.4' },
          '94%': { opacity: '1' },
          '96%': { opacity: '0.7' },
          '97%': { opacity: '1' },
        },
        'scan': {
          '0%, 100%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { transform: 'translateY(100%)', opacity: '0.8' },
        },
        'sweep': {
          '0%': { transform: 'rotate(0deg)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '90%': { opacity: '0.8' },
          '100%': { transform: 'rotate(360deg)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'data-stream': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'glitch': {
          '0%': { transform: 'translate(0)' },
          '25%': { transform: 'translate(-2px, 2px)' },
          '50%': { transform: 'translate(2px, -2px)' },
          '75%': { transform: 'translate(-1px, -1px)' },
          '100%': { transform: 'translate(0)' },
        },
      },
    },
  },
  plugins: [],
};
