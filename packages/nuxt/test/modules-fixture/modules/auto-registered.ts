import { addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auto-registered-module',
  },
  setup (_, nuxt) {
    const resolver = createResolver(import.meta.url)

    addServerHandler({
      handler: resolver.resolve('./runtime/handler'),
      route: '/auto-registered-module',
    })

    // #34982
    nuxt.hook('nitro:config', () => {
      addServerHandler({
        handler: resolver.resolve('./runtime/late-handler'),
        route: '/auto-registered-module-late',
      })
    })
  },
})
