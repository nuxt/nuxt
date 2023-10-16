import { addPlugin, createResolver, defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  defaults: {
    enabled: true,
    typeTest: (value: boolean) => typeof value === 'boolean'
  },
  meta: {
    name: 'my-module',
    configKey: 'sampleModule'
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addPlugin(resolver.resolve('./runtime/plugin'))
    useNuxt().hook('app:resolve', (app) => {
      app.middleware.push({
        name: 'unctx-test',
        path: resolver.resolve('./runtime/middleware')
      })
    })
  }
})
