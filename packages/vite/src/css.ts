import { requireModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ViteOptions } from './vite'
import { distDir } from './dirs'

export function resolveCSSOptions (nuxt: Nuxt): ViteOptions['css'] {
  const css: ViteOptions['css'] = {
    postcss: {
      plugins: []
    }
  }

  const plugins = nuxt.options.postcss.plugins

  for (const name in plugins) {
    const opts = plugins[name]
    if (!opts) {
      continue
    }
    const plugin = requireModule(name, {
      paths: [
        ...nuxt.options.modulesDir,
        distDir
      ]
    })
    // @ts-ignore
    css.postcss.plugins.push(plugin(opts))
  }

  return css
}
