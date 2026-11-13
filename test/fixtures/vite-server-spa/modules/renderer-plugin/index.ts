import { addRendererPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'renderer-plugin' },
  setup () {
    addRendererPlugin(createResolver(import.meta.url).resolve('./runtime/plugin'))
  },
})
