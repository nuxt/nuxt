import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  alias: {
    '@nuxt/test-utils': resolve('./packages/test-utils/src/index.ts')
  }
})
