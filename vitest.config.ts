import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  alias: {
    '#app': resolve('./packages/nuxt3/src/app/index.ts'),
    '@nuxt/test-utils': resolve('./packages/test-utils/src/index.ts')
  }
})
