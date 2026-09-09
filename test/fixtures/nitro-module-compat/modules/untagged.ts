import { addNitroPlugin, addServerHandler, addServerImports, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'untagged-module' },
  setup (_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // a single path, naming no server API: nitro v2 by contract, and it has to work on a
    // nitro v3 host without any user configuration
    addServerHandler({
      route: '/api/untagged',
      handler: resolver.resolve('./runtime/handler'),
    })

    addServerHandler({
      route: '/api/untagged-auto',
      handler: resolver.resolve('./runtime/auto-handler'),
    })

    addServerHandler({
      route: '/api/prefixed',
      handler: resolver.resolve('./runtime/prefixed-handler'),
    })

    addServerHandler({
      route: '/api/response-headers',
      handler: resolver.resolve('./runtime/response-headers-handler'),
    })

    // a v2 middleware inspecting the body, which must leave it readable for the route
    addServerHandler({
      route: '/api/body-echo',
      middleware: true,
      handler: resolver.resolve('./runtime/body-middleware'),
    })

    addServerImports([{ name: 'useModuleImage', from: resolver.resolve('./runtime/image') }])

    addServerHandler({
      route: '/api/untagged-rules',
      handler: resolver.resolve('./runtime/route-rules-handler'),
    })

    addServerHandler({
      route: '/api/migrated',
      handler: resolver.resolve('./runtime/migrated-handler'),
    })

    addServerHandler({
      route: '/api/bundled-h3-error',
      handler: resolver.resolve('./runtime/bundled-h3-handler'),
    })

    addServerHandler({
      route: '/api/foreign-error',
      handler: resolver.resolve('./runtime/foreign-error-handler'),
    })

    addServerHandler({
      route: '/api/unhandled-error',
      handler: resolver.resolve('./runtime/unhandled-handler'),
    })

    // module runtime reached only through the module's own alias
    nuxt.options.alias['#legacy-auth'] = resolver.resolve('./runtime/auth-service')

    addNitroPlugin(resolver.resolve('./runtime/security-plugin'))
    addNitroPlugin(resolver.resolve('./runtime/response-hooks-plugin'))

    // a module virtual whose contents are only knowable once nitro exists: rendering it
    // any earlier than `nitro:init` deadlocks the build
    let nitroReady: (preset: string) => void
    const nitroPreset = new Promise<string>((resolve) => { nitroReady = resolve })
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {}
      nitroConfig.virtual['#compat-virtual/nitro-dependent'] = async () => `export const preset = ${JSON.stringify(await nitroPreset)}`
    })
    nuxt.hook('nitro:init', (nitro) => {
      nitroReady(nitro.options.preset)
    })

    addServerHandler({
      route: '/api/nitro-dependent',
      handler: resolver.resolve('./runtime/nitro-dependent-handler'),
    })

    // a module virtual whose contents are only knowable once the app has been generated:
    // rendering it any earlier than `build:done` deadlocks the build, because the event
    // it awaits first fires inside `buildNuxt`, which runs after `nuxt.ready()` resolves
    let appReady: (count: number) => void
    const templateCount = new Promise<number>((resolve) => { appReady = resolve })
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {}
      nitroConfig.virtual['#compat-virtual/app-dependent'] = async () => `export const templates = ${JSON.stringify(await templateCount)}`
    })
    nuxt.hook('app:templatesGenerated', (app) => {
      appReady(app.templates.length)
    })

    addServerHandler({
      route: '/api/app-dependent',
      handler: resolver.resolve('./runtime/app-dependent-handler'),
    })

    // some modules bypass kit entirely and push into `nitro.options` directly
    nuxt.hook('nitro:init', (nitro) => {
      nitro.options.handlers.push({
        route: '/api/late',
        handler: resolver.resolve('./runtime/late-handler'),
      })
    })
  },
})
