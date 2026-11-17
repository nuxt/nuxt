import { addServerHandler, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'local-module' },
  setup () {
    const { resolve } = createResolver(import.meta.url)
    addServerHandler({ route: '/api/local/explicit', handler: resolve('./runtime/server/explicit') })
    addServerHandler({ route: '/api/local/injected', handler: resolve('./runtime/server/injected') })
  },
})
