/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        forest: '#3B6F49',
        moss: '#6F8F6B', 
        sage: '#A7C4A0',
        parchment: '#EFE7DB',
        primary: '#3B6F49',
        secondary: '#6F8F6B',
        accent: '#EFE7DB'
      },
      fontFamily: {
        'heading': ['Inter', 'Nunito Sans', 'system-ui', 'sans-serif'],
        'body': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}