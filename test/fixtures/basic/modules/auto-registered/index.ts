import { addRendererPlugin, addServerImports, addServerImportsDir, createResolver, defineNuxtModule } from 'nuxt/kit'

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

    addRendererPlugin(resolver.resolve('./runtime/renderer-plugin'))
  },
})
