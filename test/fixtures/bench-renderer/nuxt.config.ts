import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['../standalone-renderer/modules/renderer-artifacts'],
  devtools: { enabled: false },
  app: {
    head: {
      titleTemplate: '%s | nuxt',
      htmlAttrs: { lang: 'en' },
    },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  server: {
    builder: fileURLToPath(new URL('../standalone-renderer/server-builder.ts', import.meta.url)),
  },
})
