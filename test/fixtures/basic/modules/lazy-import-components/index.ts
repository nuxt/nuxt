import { addComponent, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'lazy-import-components',
  },
  setup () {
    const { resolve } = createResolver(import.meta.url)

    addComponent({
      name: 'NCompClient',
      export: 'NComp',
      filePath: resolve('./runtime/components'),
      mode: 'client',
    })

    addComponent({
      name: 'NCompServer',
      export: 'NComp',
      filePath: resolve('./runtime/components'),
      mode: 'server',
    })

    addComponent({
      name: 'NCompAll',
      export: 'NComp',
      filePath: resolve('./runtime/components'),
      mode: 'all',
    })
  },
})
