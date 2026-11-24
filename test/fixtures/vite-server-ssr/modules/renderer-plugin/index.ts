import { addRendererPlugin, addServerTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'renderer-plugin' },
  setup () {
    addServerTemplate({
      filename: '#renderer-plugin/template',
      getContents: () => Promise.resolve(`export const mark = 'from a server template'`),
    })
    addRendererPlugin(createResolver(import.meta.url).resolve('./runtime/plugin'))
  },
})
