import type { Module } from '@nuxt/types'
import { build } from './build'
import { getoptions } from './config'

export default <Module> function slsModule () {
  const { nuxt } = this

  if (nuxt.options.dev) {
    return
  }

  // Config
  const options = getoptions(nuxt.options, nuxt.options.serverless || {})

  // Tune webpack config
  if (options.minify !== false) {
    nuxt.options.build._minifyServer = true
  }
  nuxt.options.build.standalone = true

  // Tune generator
  nuxt.options.generate.crawler = false
  if (Array.isArray(nuxt.options.generate.routes)) {
    nuxt.options.generate.routes = Array.from(new Set([
      ...nuxt.options.generate.routes,
      ...options.static
    ]))
  }
  nuxt.options.generate.dir = options.publicDir

  // serverMiddleware
  // TODO: render:setupMiddleware hook
  // TODO: support m.prefix and m.route
  nuxt.hook('modules:done', () => {
    const unsupported = []
    for (let m of nuxt.options.serverMiddleware) {
      if (typeof m === 'string') {
        m = { handler: m }
      }

      const route = m.path || m.route || '/'
      const handle = nuxt.resolver.resolvePath(m.handler || m.handle)

      if (typeof handle !== 'string' || typeof route !== 'string') {
        unsupported.push(m)
        continue
      }

      options.serverMiddleware.push({ route, handle })
    }
    if (unsupported.length) {
      console.warn('[serverless] Unsupported Server middleware used: ', unsupported)
      console.info('Supported format is `{ path: string, handler: string }` and handler should export `(req, res) => {}`')
    }
  })

  if (options.nuxtHooks) {
    nuxt.addHooks(options.nuxtHooks)
  }

  nuxt.hook('generate:cache:ignore', (ignore: string[]) => {
    ignore.push(options.slsDir)
    ignore.push(options.targetDir)
    ignore.push(...options.generateIgnore)
  })

  nuxt.hook('generate:page', (page) => {
    // TODO: Use ssrContext
    if (!options.static.includes(page.route)) {
      page.exclude = true
    }
  })

  nuxt.hook('generate:before', async () => {
    const { entry } = await build(getoptions(nuxt.options, {
      target: 'node',
      serverMiddleware: options.serverMiddleware
    }))
    require(entry)
  })

  nuxt.hook('generate:done', () => build(options))
}
