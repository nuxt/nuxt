import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import { isWindows } from 'std-env'

export default defineConfig({
  resolve: {
    alias: {
      '#app': resolve('./packages/nuxt/src/app/index.ts'),
      '@nuxt/test-utils': resolve('./packages/test-utils/src/index.ts')
    }
  },
  esbuild: {
    tsconfigRaw: '{}'
  },
  test: {
    globalSetup: 'test/setup.ts',
    testTimeout: isWindows ? 60000 : 10000,
    deps: { inline: ['@vitejs/plugin-vue'] },
    // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
    exclude: [...configDefaults.exclude, '**/this-should-not-load.spec.js'],
    maxThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
    minThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined
  }
})
