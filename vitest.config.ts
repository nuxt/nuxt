import { resolve } from 'node:path'
import { defineConfig } from 'vite'
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
    testTimeout: isWindows ? 60000 : 10000,
    // Excluded defaults + specific plugin because it should throw an error when accidentally loaded via Nuxt
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', '**/this-should-not-load.spec.js']
  }
})
