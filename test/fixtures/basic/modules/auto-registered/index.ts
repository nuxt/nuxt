import { createResolver, defineNuxtModule, addServerHandler } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auto-registered-module'
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addServerHandler({
      handler: resolver.resolve('./runtime/handler'),
      route: '/auto-registered-module'
    })
  }
})
