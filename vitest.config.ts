import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import { isWindows } from 'std-env'

export default defineConfig({
  resolve: {
    alias: {
      '#app': resolve('./packages/nuxt/dist/app/index'),
      '@nuxt/test-utils/experimental': resolve('./packages/test-utils/src/experimental.ts'),
      '@nuxt/test-utils': resolve('./packages/test-utils/src/index.ts')
    }
  },
  test: {
    globalSetup: 'test/setup.ts',
    testTimeout: isWindows ? 60000 : 10000,
    // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
    exclude: [...configDefaults.exclude, '**/test.ts', '**/this-should-not-load.spec.js'],
    maxThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
    minThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined
  }
})
