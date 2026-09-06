import { addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'legacy-module' },
  setup (_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    addServerHandler({
      route: '/api/v2-module',
      handler: { nitro2: resolver.resolve('./runtime/v2-handler') },
    })

    // a module that has already migrated to nitro v3: emits v3 specifiers from a
    // virtual module, and relies on longest-prefix-wins alias precedence
    nuxt.options.nitro.alias = {
      ...nuxt.options.nitro.alias,
      '#legacy-probe': resolver.resolve('./runtime'),
      '#legacy-probe/specific': resolver.resolve('./runtime/probe-specific'),
      '#legacy-probe/node-variant': resolver.resolve('./runtime/probe-specific.node'),
    }
    nuxt.options.nitro.virtual = {
      ...nuxt.options.nitro.virtual,
      '#legacy-module-runtime': [
        `export { defineCachedHandler } from 'nitro/cache'`,
        `export { probe } from '#legacy-probe/specific'`,
        `export { nodeProbe } from '#legacy-probe/node-variant'`,
      ].join('\n'),
    }

    // one route, one implementation per server API: this host runs the portable one
    addServerHandler({
      route: '/api/variant',
      handler: {
        nuxt: resolver.resolve('./runtime/variant.nuxt'),
        nitro2: resolver.resolve('./runtime/variant.v2'),
      },
    })

    addServerHandler({
      route: '/api/v3-module',
      handler: { nitro3: resolver.resolve('./runtime/v3-handler') },
    })
  },
})
