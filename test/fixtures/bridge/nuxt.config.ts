import { defineNuxtConfig } from '@nuxt/bridge'

// @ts-ignore
global.__NUXT_PREPATHS__ = (global.__NUXT_PREPATHS__ || []).concat(__dirname)

export default defineNuxtConfig({
  components: true,
  serverMiddleware: [
    {
      handle (req, _res, next) {
        req.spa = req.url.includes('?spa')
        next()
      }
    }
  ],
  buildDir: process.env.NITRO_BUILD_DIR,
  plugins: ['~/plugins/setup.js'],
  nitro: {
    output: { dir: process.env.NITRO_OUTPUT_DIR }
  }
})
