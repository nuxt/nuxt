import { createResolver, defineNuxtModule, useNuxt } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auto-registered-module'
  },
  setup () {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)

    nuxt.options.nitro.handlers = nuxt.options.nitro.handlers || []
    nuxt.options.nitro.handlers.push({
      handler: resolver.resolve('./runtime/handler'),
      route: '/auto-registered-module'
    })
  }
})
