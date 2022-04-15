import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { isWindows } from 'std-env'

export default defineConfig({
  alias: {
    '#app': resolve('./packages/nuxt3/src/app/index.ts'),
    '@nuxt/test-utils': resolve('./packages/test-utils/src/index.ts')
  },
  esbuild: {
    tsconfigRaw: '{}'
  },
  test: {
    testTimeout: isWindows ? 60000 : 10000
  }
})
