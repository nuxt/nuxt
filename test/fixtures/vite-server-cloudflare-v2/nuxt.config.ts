import { cloudflare } from '@cloudflare/vite-plugin'

export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Nuxt on Workers',
    },
  },
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  vite: {
    plugins: [cloudflare()],
  },
  // the overlay is skipped when `test` is set
  test: false,
  server: {
    builder: 'vite',
  },
})
