import { addRendererPlugin, addServerImports, addServerImportsDir, addServerTemplate, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auto-registered-module',
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addServerImports([{
      from: resolver.resolve('./runtime/some-server-import'),
      name: 'serverAutoImported',
      as: 'autoimportedFunction',
    }, {
      from: resolver.resolve('./runtime/some-server-import'),
      name: 'someUtils',
    }])

    addServerImportsDir(resolver.resolve('./runtime/server/utils'))

    addServerTemplate({
      filename: '#auto-registered/template',
      getContents: () => `export const mark = 'from a server template'`,
    })

    addRendererPlugin(resolver.resolve('./runtime/renderer-plugin'))
  },
})
