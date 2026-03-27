export default defineNuxtConfig({
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'stylesheet', href: 'https://fonts.cdnfonts.com/css/geist-mono' },
      ],
    },
  },
  compatibilityDate: 'latest',
})
