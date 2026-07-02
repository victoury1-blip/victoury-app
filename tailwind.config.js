/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'scan-line': {
          '0%, 100%': { transform: 'translateY(-96px)', opacity: '0.9' },
          '50%': { transform: 'translateY(96px)', opacity: '0.9' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.25s ease-out',
        'scan-line': 'scan-line 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
