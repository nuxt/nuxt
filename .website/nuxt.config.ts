import { createResolver } from 'nuxt/kit'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  // https://github.com/nuxt-themes/docus
  extends: '@nuxt-themes/docus',
  content: {
    sources: {
      docs: {
        driver: 'fs',
        prefix: '/',
        base: resolve('../docs')
      }
    }
  },
  experimental: {
    renderJsonPayloads: false
  }
})
