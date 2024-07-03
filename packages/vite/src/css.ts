import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { InlineConfig as ViteConfig } from 'vite'
import type { Plugin } from 'postcss'
import { createJiti } from 'jiti'

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  return typeof order === 'function' ? order(names) : (order || names)
}

export async function resolveCSSOptions (nuxt: Nuxt): Promise<ViteConfig['css']> {
  const css: ViteConfig['css'] & { postcss: NonNullable<Exclude<NonNullable<ViteConfig['css']>['postcss'], string>> } = {
    postcss: {
      plugins: [],
    },
  }

  css.postcss.plugins = []
  const postcssOptions = nuxt.options.postcss

  const jiti = createJiti(nuxt.options.rootDir, {
    interopDefault: true,
    alias: nuxt.options.alias,
  })

  for (const pluginName of sortPlugins(postcssOptions)) {
    const pluginOptions = postcssOptions.plugins[pluginName]
    if (!pluginOptions) { continue }

    const path = jiti.esmResolve(pluginName)
    const pluginFn = (await jiti.import(path)) as (opts: Record<string, any>) => Plugin
    if (typeof pluginFn === 'function') {
      css.postcss.plugins.push(pluginFn(pluginOptions))
    } else {
      console.warn(`[nuxt] could not import postcss plugin \`${pluginName}\`. Please report this as a bug.`)
    }
  }

  return css
}
