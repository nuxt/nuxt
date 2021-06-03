import { wpfs, getNitroContext, createDevServer, resolveMiddleware, build, prepare, generate } from '@nuxt/nitro'
import type { Nuxt } from '@nuxt/kit'

export function initNitro (nuxt: Nuxt) {
  // Create contexts
  const nitroOptions = (nuxt.options as any).nitro || {}
  const nitroContext = getNitroContext(nuxt.options, nitroOptions)
  const nitroDevContext = getNitroContext(nuxt.options, { ...nitroOptions, preset: 'dev' })

  nuxt.server = createDevServer(nitroDevContext)

  // Connect hooks
  // @ts-ignore
  nuxt.hooks.addHooks(nitroContext.nuxtHooks)
  nuxt.hook('close', () => nitroContext._internal.hooks.callHook('close'))

  // @ts-ignore
  nuxt.hooks.addHooks(nitroDevContext.nuxtHooks)
  nuxt.hook('close', () => nitroDevContext._internal.hooks.callHook('close'))

  // Expose process.env.NITRO_PRESET
  nuxt.options.env.NITRO_PRESET = nitroContext.preset

  nitroContext._internal.hooks.hook('nitro:template', template => nuxt.callHook('nitro:template', template))

  // Wait for all modules to be ready
  nuxt.hook('modules:done', async () => {
    // Extend nitro with modules
    await nuxt.callHook('nitro:context', nitroContext)
    await nuxt.callHook('nitro:context', nitroDevContext)

    // Resolve middleware
    const { middleware, legacyMiddleware } = resolveMiddleware(nuxt)
    nuxt.server.setLegacyMiddleware(legacyMiddleware)
    nitroContext.middleware.push(...middleware)
    nitroDevContext.middleware.push(...middleware)
  })

  // nuxt build/dev
  nuxt.hook('build:done', async () => {
    if (nuxt.options.dev) {
      await build(nitroDevContext)
    } else if (!nitroContext._nuxt.isStatic) {
      await prepare(nitroContext)
      await generate(nitroContext)
      await build(nitroContext)
    }
  })

  // nuxt dev
  if (nuxt.options.dev) {
    nitroDevContext._internal.hooks.hook('nitro:compiled', () => { nuxt.server.watch() })
    nuxt.hook('build:compile', ({ compiler }) => { compiler.outputFileSystem = wpfs })
    nuxt.hook('server:devMiddleware', (m) => { nuxt.server.setDevMiddleware(m) })
  }
}
