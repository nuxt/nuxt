import { addServerHandler, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'variants' },
  setup () {
    const { resolve } = createResolver(import.meta.url)
    addServerHandler({
      route: '/api/variant',
      handler: {
        nitro2: resolve('./runtime/nitro2.ts'),
        nitro3: resolve('./runtime/nitro3.ts'),
        nuxt: resolve('./runtime/portable.ts'),
      },
    })
    addServerHandler({ route: '/api/variant-nitro2', handler: { nitro2: resolve('./runtime/nitro2.ts') } })
  },
})
