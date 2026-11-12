import { defineConfig } from '@cloudflare/config'

export default defineConfig({
  worker: {
    name: 'nuxt-vite-server-cloudflare-v2',
    compatibilityDate: '2026-01-01',
    entrypoint: './worker/index.ts',
  },
})
