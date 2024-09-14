import createResolver from 'postcss-import-resolver'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import type { Plugin } from 'postcss'

const isPureObject = (obj: unknown): obj is object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  return typeof order === 'function' ? order(names) : (order || names)
}

export async function getPostcssConfig (nuxt: Nuxt) {
  if (!nuxt.options.webpack.postcss || !nuxt.options.postcss) {
    return false
  }

  const postcssOptions = defu({}, nuxt.options.postcss, {
    plugins: {
      /**
       * https://github.com/postcss/postcss-import
       */
      'postcss-import': {
        resolve: createResolver({
          alias: { ...nuxt.options.alias },
          modules: nuxt.options.modulesDir,
        }),
      },

      /**
       * https://github.com/postcss/postcss-url
       */
      'postcss-url': {},
    },
    sourceMap: nuxt.options.webpack.cssSourceMap,
  })

  const jiti = createJiti(nuxt.options.rootDir, {
    interopDefault: true,
    alias: nuxt.options.alias,
  })

  // Keep the order of default plugins
  if (!Array.isArray(postcssOptions.plugins) && isPureObject(postcssOptions.plugins)) {
    // Map postcss plugins into instances on object mode once
    const plugins: Plugin[] = []
    for (const pluginName of sortPlugins(postcssOptions)) {
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions) { continue }

      const path = jiti.esmResolve(pluginName)
      const pluginFn = (await jiti.import(path)) as (opts: Record<string, any>) => Plugin
      if (typeof pluginFn === 'function') {
        plugins.push(pluginFn(pluginOptions))
      } else {
        console.warn(`[nuxt] could not import postcss plugin \`${pluginName}\`. Please report this as a bug.`)
      }
    }

    // @ts-expect-error we are mutating type here from object to array
    postcssOptions.plugins = plugins
  }

  return {
    sourceMap: nuxt.options.webpack.cssSourceMap,
    ...nuxt.options.webpack.postcss,
    postcssOptions,
  }
}
