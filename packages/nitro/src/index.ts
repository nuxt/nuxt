import hasha from 'hasha'
import type { Module } from '@nuxt/types'
import { build } from './build'
import { getoptions } from './config'

export default <Module> function slsModule () {
  const { nuxt } = this

  if (nuxt.options.dev) {
    return
  }

  // Config
  const options = getoptions(nuxt)

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
    for (let m of nuxt.options.serverMiddleware) {
      if (typeof m === 'string') {
        m = { handler: m }
      }
      if (typeof m.handler !== 'string') {
        console.warn('[Serverless] Unsupported serverMiddleware format:', m)
        continue
      }

      const route = m.path || m.route || '/'
      const handle = nuxt.resolver.resolvePath(m.handler || m.handle)
      const id = '_' + hasha(handle).substr(0, 6)
      options.serverMiddleware.push({ route, id, handle })
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

  nuxt.hook('generate:done', () => build(options))
}
