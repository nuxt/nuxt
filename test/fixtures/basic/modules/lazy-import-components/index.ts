import { addComponent, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'lazy-import-components',
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addComponent({
      name: 'NCompClient',
      export: 'NComp',
      filePath: resolver.resolve('./runtime/components'),
      mode: 'client',
    })

    addComponent({
      name: 'NCompServer',
      export: 'NComp',
      filePath: resolver.resolve('./runtime/components'),
      mode: 'server',
    })

    addComponent({
      name: 'NCompAll',
      export: 'NComp',
      filePath: resolver.resolve('./runtime/components'),
      mode: 'all',
    })
  },
})
