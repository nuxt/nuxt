import { requireModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { InlineConfig as ViteConfig } from 'vite'
import { distDir } from './dirs'

export function resolveCSSOptions (nuxt: Nuxt): ViteConfig['css'] {
  const css: ViteConfig['css'] & { postcss: NonNullable<Exclude<NonNullable<ViteConfig['css']>['postcss'], string>> } = {
    postcss: {
      plugins: []
    }
  }

  const lastPlugins = ['autoprefixer', 'cssnano']
  css.postcss.plugins = Object.entries(nuxt.options.postcss.plugins)
    .sort((a, b) => lastPlugins.indexOf(a[0]) - lastPlugins.indexOf(b[0]))
    .filter(([, opts]) => opts)
    .map(([name, opts]) => {
      const plugin = requireModule(name, {
        paths: [
          ...nuxt.options.modulesDir,
          distDir
        ]
      })
      return plugin(opts)
    })

  return css
}
