import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],
  compatibilityDate: 'latest',
  vite: {
    plugins: [tailwindcss()],
  },

})
