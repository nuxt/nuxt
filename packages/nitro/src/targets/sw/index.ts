import { resolve } from 'path'
import consola from 'consola'

export default {
  entry: require.resolve('./entry'),
  node: false,
  copyAssets: '.',
  outName: 'nuxt.sw.js',
  templates: [
    { src: resolve(__dirname, 'index.html'), dst: 'index.html' },
    { src: resolve(__dirname, 'index.html'), dst: '200.html' }
  ],
  hooks: {
    config (config) {
      if (config.nuxt === 2) {
        config.renderer = 'vue2.basic'
      }
    },
    'rollup:before' ({ rollupConfig }) {
      rollupConfig.output.intro =
        'const global = {}; const exports = {}; const module = { exports }; const process = { env: {}, hrtime: () => [0,0]};' +
      rollupConfig.output.intro
      rollupConfig.output.format = 'iife'
    },
    done ({ outDir }) {
      consola.info(`Try with \`npx serve ${outDir}\``)
    }
  }
}
