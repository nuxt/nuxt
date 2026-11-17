import { addRendererPlugin, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'render-document' },
  setup () {
    const { resolve } = createResolver(import.meta.url)

    addRendererPlugin(resolve('./runtime/before'))
    addRendererPlugin(resolve('./runtime/document'))
    addRendererPlugin(resolve('./runtime/after'))
  },
})
