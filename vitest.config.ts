import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import { isWindows } from 'std-env'

export default defineConfig({
  resolve: {
    alias: {
      '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
      '#build/paths.mjs': resolve('./test/mocks/paths'),
      '#build/app.config.mjs': resolve('./test/mocks/app-config'),
      '#app': resolve('./packages/nuxt/dist/app')
    }
  },
  define: {
    'process.env.NUXT_ASYNC_CONTEXT': 'false'
  },
  test: {
    globalSetup: './test/setup.ts',
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: isWindows ? 60000 : 10000,
    // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
    exclude: [...configDefaults.exclude, 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js'],
    poolOptions: {
      threads: {
        maxThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
        minThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined
      }
    }
  }
})
