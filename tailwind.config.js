/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background-color)',
        text: 'var(--text-color)',
      }
    },
  },
  plugins: [],
} 