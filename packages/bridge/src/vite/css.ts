import createResolver from 'postcss-import-resolver'
import defu from 'defu'
import type { Nuxt, ViteOptions } from './types'

// Ref: https://github.com/nuxt/nuxt.js/blob/dev/packages/webpack/src/utils/postcss.js

export function resolveCSSOptions (nuxt: Nuxt): ViteOptions['css'] {
  const css: ViteOptions['css'] = {
    postcss: {
      plugins: []
    }
  }

  const plugins = defu(nuxt.options.build.postcss.plugins, {
    // https://github.com/postcss/postcss-import
    'postcss-import': {
      resolve: createResolver({
        alias: { ...nuxt.options.alias },
        modules: [
          nuxt.options.srcDir,
          nuxt.options.rootDir,
          ...nuxt.options.modulesDir
        ]
      })
    },

    // https://github.com/postcss/postcss-url
    'postcss-url': {},

    // https://github.com/csstools/postcss-preset-env
    'postcss-preset-env': nuxt.options.build.postcss.preset || {}
  })

  for (const name in plugins) {
    const opts = plugins[name]
    if (!opts) {
      continue
    }
    const plugin = nuxt.resolver.requireModule(name)
    // @ts-ignore
    css.postcss.plugins.push(plugin(opts))
  }

  return css
}
