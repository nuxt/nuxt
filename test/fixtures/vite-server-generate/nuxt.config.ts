export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Pure Vite generate',
    },
  },
  routeRules: {
    '/rules/prerendered': { prerender: true },
    '/rules/ignored': { prerender: false },
  },
  sourcemap: false,
  experimental: {
    payloadExtraction: true,
  },
  compatibilityDate: 'latest',
  nitro: {
    prerender: {
      ignore: ['/ignored'],
    },
  },
  server: {
    builder: 'vite',
  },
})
