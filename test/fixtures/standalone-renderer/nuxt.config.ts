import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['./modules/renderer-artifacts'],
  devtools: { enabled: false },
  app: {
    head: {
      titleTemplate: '%s | nuxt',
    },
  },
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  sourcemap: false,
  experimental: {
    writeEarlyHints: true,
  },
  compatibilityDate: 'latest',
  hooks: {
    // stands in for a module (like `@nuxt/fonts`) registering a non-script preload
    'build:manifest' (manifest) {
      for (const chunk of Object.values(manifest)) {
        if (chunk.isEntry) {
          chunk.assets ||= []
          chunk.assets.push('fonts/standalone.woff2')
        }
      }
      manifest['fonts/standalone.woff2'] = {
        file: 'fonts/standalone.woff2',
        resourceType: 'font',
        mimeType: 'font/woff2',
        preload: true,
      }
    },
  },
  server: {
    builder: fileURLToPath(new URL('./server-builder.ts', import.meta.url)),
  },
})
