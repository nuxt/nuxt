import { addServerPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'legacy-server-plugin' },
  setup () {
    const resolver = createResolver(import.meta.url)
    addServerPlugin(resolver.resolve('./runtime/legacy-plugin'))
  },
})
