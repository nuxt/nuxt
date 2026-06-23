import { addServerHandler, addServerImports, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auto-registered-module',
  },
  setup () {
    const resolver = createResolver(import.meta.url)

    addServerHandler({
      handler: resolver.resolve('./runtime/handler'),
      route: '/auto-registered-module',
    })

    // Server-only auto-imports, importable from `#imports/server`
    // https://github.com/nuxt/nuxt/issues/33979
    addServerImports([
      {
        from: resolver.resolve('./runtime/some-server-import'),
        name: 'serverAutoImported',
      },
      {
        from: resolver.resolve('./runtime/some-server-import'),
        name: 'someServerUtil',
      },
    ])
  },
})
