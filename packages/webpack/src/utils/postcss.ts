import { fileURLToPath, pathToFileURL } from 'node:url'
import createResolver from 'postcss-import-resolver'
import { interopDefault } from 'mlly'
import { requireModule, tryResolveModule } from '@nuxt/kit'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { defu } from 'defu'
import type { Plugin } from 'postcss'

const isPureObject = (obj: unknown): obj is Object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

const ensureItemIsLast = (item: string) => (arr: string[]) => {
  const index = arr.indexOf(item)
  if (index !== -1) {
    arr.splice(index, 1)
    arr.push(item)
  }
  return arr
}

const orderPresets = {
  cssnanoLast: ensureItemIsLast('cssnano'),
  autoprefixerLast: ensureItemIsLast('autoprefixer'),
  autoprefixerAndCssnanoLast (names: string[]) {
    return orderPresets.cssnanoLast(orderPresets.autoprefixerLast(names))
  },
}

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  if (typeof order === 'string') {
    order = orderPresets[order]
  }
  return typeof order === 'function' ? order(names, orderPresets) : (order || names)
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
    // Array, String or Function
    order: 'autoprefixerAndCssnanoLast' as const,
  })

  // Keep the order of default plugins
  if (!Array.isArray(postcssOptions.plugins) && isPureObject(postcssOptions.plugins)) {
    // Map postcss plugins into instances on object mode once
    const cwd = fileURLToPath(new URL('.', import.meta.url))
    const plugins: Plugin[] = []
    for (const pluginName in sortPlugins(postcssOptions)) {
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions) { continue }

      const path = await tryResolveModule(pluginName, nuxt.options.modulesDir)

      let pluginFn: (opts: Record<string, any>) => Plugin
      if (path) {
        pluginFn = await import(pathToFileURL(path).href).then(interopDefault)
      } else {
        console.warn(`[nuxt] could not import postcss plugin \`${pluginName}\` with ESM. Please report this as a bug.`)
        // fall back to cjs
        pluginFn = requireModule(pluginName, { paths: [cwd] })
      }
      if (typeof pluginFn === 'function') {
        plugins.push(pluginFn(pluginOptions))
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
