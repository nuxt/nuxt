import NuxtConfiguration from '@nuxt/config'

const config: NuxtConfiguration = {
  modules: [
    '~/modules/module'
  ],
  plugins: [
    '~/plugins/plugin'
  ],
  serverMiddleware: [
    '~/server-middleware/test.ts'
  ]
}

export default config
