import { withTrailingSlash } from 'ufo'

export default defineNuxtConfig({
  extends: process.env.WEBSITE_THEME ? withTrailingSlash(process.env.WEBSITE_THEME) : 'nuxt-website-theme',
  build: {
    transpile: [/nuxt-website-theme/]
  },
  nitro: {
    esbuild: {
      options: {
        exclude: []
      }
    }
  },
  vite: {
    server: {
      fs: {
        allow: [
          process.env.WEBSITE_THEME || '.'
        ]
      }
    }
  }
})
