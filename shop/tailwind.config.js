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
      // `ink` suit une variable CSS plutôt qu'une teinte figée : c'est ce qui
      // permet de la régler depuis /store/theme sans recompiler le site.
      colors: { ink: 'var(--ink)', sand: '#F7F5F2' },
    },
  },
  plugins: [],
};
