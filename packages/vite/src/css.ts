import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { InlineConfig as ViteConfig } from 'vite'
import type { Plugin } from 'postcss'
import { createJiti } from 'jiti'
import { ensureDependencyInstalled, logger } from '@nuxt/kit'

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  return typeof order === 'function' ? order(names) : (order || names)
}

export async function resolveCSSOptions (nuxt: Nuxt): Promise<ViteConfig['css']> {
  const css: ViteConfig['css'] & { postcss: NonNullable<Exclude<NonNullable<ViteConfig['css']>['postcss'], string>> & { plugins: Plugin[] } } = {
    postcss: {
      plugins: [],
    },
  }

  const postcssOptions = nuxt.options.postcss

  const jiti = createJiti(nuxt.options.rootDir, { alias: nuxt.options.alias })

  for (const pluginName of sortPlugins(postcssOptions)) {
    const pluginOptions = postcssOptions.plugins[pluginName]
    if (!pluginOptions) { continue }

    const pluginFn = await resolvePostcssPlugin(jiti, pluginName, nuxt)
    if (typeof pluginFn === 'function') {
      css.postcss.plugins.push(pluginFn(pluginOptions))
    }
  }

  return css
}

async function resolvePostcssPlugin (jiti: ReturnType<typeof createJiti>, pluginName: string, nuxt: Nuxt): Promise<((opts: Record<string, any>) => Plugin) | undefined> {
  for (const parentURL of nuxt.options.modulesDir) {
    const pluginFn = await jiti.import(pluginName, { parentURL: parentURL.replace(/\/node_modules\/?$/, ''), try: true, default: true }) as (opts: Record<string, any>) => Plugin
    if (typeof pluginFn === 'function') {
      return pluginFn
    }
  }

  // Plugin not found - prompt the user to install it
  const installed = await ensureDependencyInstalled(pluginName, {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })

  if (installed) {
    // Retry resolution after installation
    for (const parentURL of nuxt.options.modulesDir) {
      const pluginFn = await jiti.import(pluginName, { parentURL: parentURL.replace(/\/node_modules\/?$/, ''), try: true, default: true }) as (opts: Record<string, any>) => Plugin
      if (typeof pluginFn === 'function') {
        return pluginFn
      }
    }
  }

  logger.warn(`Could not load postcss plugin \`${pluginName}\`.`)
}
