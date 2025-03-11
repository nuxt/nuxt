import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'
import { isCI, isWindows } from 'std-env'
import codspeedPlugin from '@codspeed/vitest-plugin'

export default defineConfig({
  plugins: isCI ? [codspeedPlugin()] : [],
  resolve: {
    alias: {
      '#app': resolve('./packages/nuxt/dist/app'),
    },
  },
  test: {
    setupFiles: [],
    testTimeout: isWindows ? 60000 : 10000,
    poolOptions: {
      threads: {
        maxThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
        minThreads: process.env.TEST_ENV === 'dev' ? 1 : undefined,
      },
    },
  },
})
