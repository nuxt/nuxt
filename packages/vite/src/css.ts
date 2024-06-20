import { requireModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { InlineConfig as ViteConfig } from 'vite'
import { distDir } from './dirs'

const lastPlugins = ['autoprefixer', 'cssnano']

export function resolveCSSOptions (nuxt: Nuxt): ViteConfig['css'] {
  const css: ViteConfig['css'] & { postcss: NonNullable<Exclude<NonNullable<ViteConfig['css']>['postcss'], string>> } = {
    postcss: {
      plugins: [],
    },
  }

  css.postcss.plugins = []

  const plugins = Object.entries(nuxt.options.postcss.plugins)
    .sort((a, b) => lastPlugins.indexOf(a[0]) - lastPlugins.indexOf(b[0]))

  for (const [name, opts] of plugins) {
    if (opts) {
      // TODO: remove use of requireModule in favour of ESM import
      const plugin = requireModule(name, {
        paths: [
          ...nuxt.options.modulesDir,
          distDir,
        ],
      })
      css.postcss.plugins.push(plugin(opts))
    }
  }

  return css
}
