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
  // the renderer benchmark resolves the build artifacts through fixed paths
  buildDir: '.nuxt',
  sourcemap: false,
  compatibilityDate: 'latest',
  server: {
    builder: fileURLToPath(new URL('../standalone-renderer/server-builder.ts', import.meta.url)),
  },
})
