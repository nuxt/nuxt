import { addServerHandler, addServerImports, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'module-with-dep' },
  setup () {
    const resolver = createResolver(import.meta.url)
    addServerImports([{ name: 'useModuleOnlyDep', from: 'module-only-dep' }])
    addServerHandler({ route: '/api/module-legacy', handler: resolver.resolve('./runtime/legacy') })
  },
})
