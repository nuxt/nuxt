import { addServerHandler, addServerImports, addServerImportsDir, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auto-registered-module'
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addServerHandler({
      handler: resolver.resolve('./runtime/handler'),
      route: '/auto-registered-module'
    })

    addServerImports([{
      from: resolver.resolve('./runtime/some-server-import'),
      name: 'serverAutoImported',
      as: 'autoimportedFunction'
    }, {
      from: resolver.resolve('./runtime/some-server-import'),
      name: 'someUtils'
    }])

    addServerImportsDir(resolver.resolve('./runtime/server/utils'))
  }
})
