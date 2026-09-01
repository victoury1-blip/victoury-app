/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Le nom de la marque est dessiné en capitales largement espacées :
        // une grotesque géométrique s'en approche sans acheter de fonte.
        display: ['Jost', 'Futura', 'Century Gothic', 'system-ui', 'sans-serif'],
        sans: ['Jost', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: { ink: '#111111', sand: '#F7F5F2' },
    },
  },
  plugins: [],
};
