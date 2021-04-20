import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule(nuxt => ({
  name: 'windicss',
  defaults: {
    root: nuxt.options.rootDir,
    scan: {
      dirs: ['./'],
      exclude: [
        'node_modules',
        '.git',
        '.github',
        '.nuxt/**/*',
        '*.template.html',
        'app.html'
      ]
    }
  },
  setup (options, nuxt) {
    nuxt.options.build.transpile.push('windi.css')

    nuxt.hook('vite:extend', async ({ config }) => {
      const WindiCSS = await import('vite-plugin-windicss').then(r => r.default)
      config.plugins.push(WindiCSS(options))
      config.optimizeDeps = {
        exclude: [
          'windi.css',
          'virtual:windi.css'
        ]
      }
    })

    nuxt.hook('webpack:config', async (configs) => {
      const WindiCSSWebpackPlugin = await import('windicss-webpack-plugin').then(r => r.default)
      const windiPlugin = new WindiCSSWebpackPlugin(options)
      configs.forEach((config) => { config.plugins.push(windiPlugin) })
    })
  }
}))
