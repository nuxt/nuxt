import { resolve } from 'pathe'
import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config'
import { isCI, isWindows } from 'std-env'
import codspeedPlugin from '@codspeed/vitest-plugin'

export default defineConfig({
  plugins: isCI ? [codspeedPlugin() as any] : [],
  resolve: {
    alias: {
      '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
      '#build/router.options': resolve('./test/mocks/router-options'),
      '#internal/nuxt/paths': resolve('./test/mocks/paths'),
      '#build/app.config.mjs': resolve('./test/mocks/app-config'),
      '#app': resolve('./packages/nuxt/dist/app'),
    },
  },
  test: {
    setupFiles: ['./test/setup-env.ts'],
    coverage: {
      exclude: [...coverageConfigDefaults.exclude, 'packages/nuxt/src/app', 'playground', '**/test/', 'scripts', 'vitest.nuxt.config.ts'],
    },
    testTimeout: isWindows ? 60000 : 10000,
    // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
    exclude: [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js'],
    poolOptions: {
      threads: {
        maxThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
        minThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
      },
    },
  },
})
