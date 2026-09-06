import { fileURLToPath } from 'node:url'
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
    plugins: [cloudflare({ configPath: fileURLToPath(new URL('wrangler.jsonc', import.meta.url)) })],
  },
  server: {
    builder: 'vite',
  },
})
