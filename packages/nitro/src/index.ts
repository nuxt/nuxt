import type { Module } from '@nuxt/types'
import { build, compileHTMLTemplate } from './build'
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

  nuxt.hook('generate:cache:ignore', (ignore) => {
    ignore.push(options.slsDir)
  })

  nuxt.hook('generate:page', (page) => {
    // TODO: Use ssrContext
    if (!options.static.includes(page.route)) {
      page.exclude = true
    }
  })

  nuxt.hook('generate:done', () => buildSLS(options))
}

async function buildSLS (options) {
  // Compile html template
  await compileHTMLTemplate(options)

  // Bundle target
  await build(options)
}
