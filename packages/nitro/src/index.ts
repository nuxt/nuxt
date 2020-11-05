import { build, compileHTMLTemplate } from './build'
import { getBaseConfig } from './config'

export default function () {
  const { nuxt } = this

  if (nuxt.options.dev) {
    return
  }

  // Config
  const baseConfig = getBaseConfig(nuxt.options)

  if (baseConfig.minify !== false) {
    nuxt.options.build._minifyServer = true
  }

  nuxt.options.build.standalone = true

  nuxt.hook('generate:cache:ignore', (ignore) => {
    ignore.push(baseConfig.slsDir)
  })

  nuxt.hook('generate:page', (page) => {
    // TODO: Use ssrContext
    if (!baseConfig.static.includes(page.route)) {
      page.exclude = true
    }
  })

  nuxt.hook('generate:done', () => buildSLS(baseConfig))
}

async function buildSLS (baseConfig) {
  // Compile html template
  await compileHTMLTemplate(baseConfig)

  // Bundle for each target
  for (const target of baseConfig.targets) {
    if (baseConfig.target && target.target !== baseConfig.target) {
      continue
    }
    await build(baseConfig, target)
  }
}
