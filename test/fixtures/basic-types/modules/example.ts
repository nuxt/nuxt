import { addPlugin, createResolver, defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  defaults: {
    enabled: true,
    typeTest: (value: boolean) => typeof value === 'boolean',
  },
  meta: {
    name: 'my-module',
    configKey: 'sampleModule',
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addPlugin(resolver.resolve('./runtime/plugin'))
    useNuxt().hook('app:resolve', (app) => {
      app.middleware.push({
        name: 'unctx-test',
        path: resolver.resolve('./runtime/middleware'),
      })
    })
    useNuxt().hook('my-module:augmented-hook', (payload) => {
      // Asserts the augmented hook signature is reachable from inside the
      // module's own `useNuxt().hook(...)` call.
      const _: string = payload.message
    })
  },
})

declare module '@nuxt/schema' {
  interface NuxtHooks {
    /** Test hook used to verify augmented hooks reach `NuxtConfig['hooks']`. */
    'my-module:augmented-hook': (payload: { message: string }) => void
  }
}
