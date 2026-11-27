import { addRendererPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'renderer-runtime' },
  setup () {
    addRendererPlugin(createResolver(import.meta.url).resolve('./runtime/plugin'))
  },
})
