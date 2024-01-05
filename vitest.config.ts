import { resolve } from 'node:path'
import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config'
import { isWindows } from 'std-env'
import codspeedPlugin from '@codspeed/vitest-plugin'

export default defineConfig({
  plugins: [codspeedPlugin()],
  resolve: {
    alias: {
      '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
      '#build/paths.mjs': resolve('./test/mocks/paths'),
      '#build/app.config.mjs': resolve('./test/mocks/app-config'),
      '#app': resolve('./packages/nuxt/dist/app')
    }
  },
  test: {
    globalSetup: './test/setup.ts',
    setupFiles: ['./test/setup-env.ts'],
    coverage: {
      exclude: [...coverageConfigDefaults.exclude, 'packages/nuxt/src/app', 'playground', '**/test/', 'scripts', 'vitest.nuxt.config.ts']
    },
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
