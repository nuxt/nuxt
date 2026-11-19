import { createRequire } from 'node:module'
import { join } from 'node:path'
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
      '#legacy-h3': 'h3',
    }

    // a module that pins `h3` to the h3 v1 that nitropack depends on
    nuxt.hook('nitro:config', (nitroConfig) => {
      const require = createRequire(import.meta.url)
      nitroConfig.alias ||= {}
      nitroConfig.alias.h3 ??= createRequire(require.resolve('nitropack/package.json')).resolve('h3')
    })

    // a module whose error handler responds to some errors before the one Nuxt registers
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.errorHandler = [resolver.resolve('./runtime/error-handler'), ...[nitroConfig.errorHandler || []].flat()]
    })

    addServerHandler({
      route: '/api/aliased-h3',
      handler: resolver.resolve('./runtime/aliased-h3'),
    })
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

    // a module that reads what the prerenderer stored and ships it to the server as an asset
    nuxt.options.routeRules = { ...nuxt.options.routeRules, '/prerendered': { prerender: true } }
    nuxt.hook('nitro:init', (nitro: any) => {
      nitro.hooks.hook('prerender:done', async () => {
        const routes = await nitro.storage.getItem('build:legacy-storage:prerendered.json')
        await nitro.storage.setItem('build:legacy-storage-assets:routes.json', routes)
        nitro.options.serverAssets.push({ baseName: 'legacy-storage', dir: join(nuxt.options.buildDir, 'legacy-storage-assets') })
      })
    })
  },
})
