import { requireModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ViteOptions } from './vite'
import { distDir } from './dirs'

export function resolveCSSOptions (nuxt: Nuxt): ViteOptions['css'] {
  const css: ViteOptions['css'] & { postcss: Exclude<ViteOptions['css']['postcss'], string> } = {
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
