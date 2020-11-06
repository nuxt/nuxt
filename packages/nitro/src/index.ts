import type { Module } from '@nuxt/types'
import { build } from './build'
import { getoptions } from './config'

export default <Module> function slsModule () {
  const { nuxt } = this

  if (nuxt.options.dev) {
    return
  }

  // Config
  const options = getoptions(nuxt.options)

  if (options.minify !== false) {
    nuxt.options.build._minifyServer = true
  }

  nuxt.options.build.standalone = true

  nuxt.options.generate.crawler = false
  if (Array.isArray(nuxt.options.generate.routes)) {
    nuxt.options.generate.routes = Array.from(new Set([
      ...nuxt.options.generate.routes,
      ...options.static
    ]))
  }

  if (options.nuxtHooks) {
    nuxt.addHooks(options.nuxtHooks)
  }

  nuxt.hook('generate:cache:ignore', (ignore) => {
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
