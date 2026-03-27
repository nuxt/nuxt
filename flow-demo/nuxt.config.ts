export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  app: {
    head: {
      link: [
        { rel: 'stylesheet', href: 'https://fonts.cdnfonts.com/css/geist-mono' },
      ],
    },
  },
})
