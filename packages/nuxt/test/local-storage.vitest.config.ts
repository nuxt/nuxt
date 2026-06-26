import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'local-storage-test',
    include: ['packages/nuxt/test/local-storage.test.ts'],
  },
  define: {
    'import.meta.server': false,
    'import.meta.dev': true,
  },
  esbuild: {
    target: 'es2022',
  },
})
