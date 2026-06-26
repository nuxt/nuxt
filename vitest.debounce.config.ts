import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    'import.meta.client': 'true',
  },
  test: {
    include: ['packages/nuxt/test/debounce.test.ts'],
  },
})
