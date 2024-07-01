import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireModule, tryResolveModule } from '@nuxt/kit'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { InlineConfig as ViteConfig } from 'vite'
import { interopDefault } from 'mlly'
import type { Plugin } from 'postcss'

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

export async function resolveCSSOptions (nuxt: Nuxt): Promise<ViteConfig['css']> {
  const css: ViteConfig['css'] & { postcss: NonNullable<Exclude<NonNullable<ViteConfig['css']>['postcss'], string>> } = {
    postcss: {
      plugins: [],
    },
  }

  css.postcss.plugins = []

  const postcssOptions = nuxt.options.postcss

  const cwd = fileURLToPath(new URL('.', import.meta.url))
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
      css.postcss.plugins.push(pluginFn(pluginOptions))
    }
  }

  return css
}
