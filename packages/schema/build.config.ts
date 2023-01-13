import { copyFile } from 'node:fs/promises'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    {
      input: 'src/config/index',
      outDir: 'schema',
      name: 'config',
      builder: 'untyped',
      defaults: {
        rootDir: '/<rootDir>/',
        vite: {
          base: '/'
        }
      }
    },
    'src/index',
  ],
  externals: [
    // Type imports
    'vue-router',
    'vue-bundle-renderer',
    '@unhead/schema',
    'vue',
    'hookable',
    'nitropack',
    'webpack',
    'webpack-bundle-analyzer',
    'rollup-plugin-visualizer',
    'vite',
    '@vitejs/plugin-vue',
    'mini-css-extract-plugin',
    'terser-webpack-plugin',
    'css-minimizer-webpack-plugin',
    'webpack-dev-middleware',
    'h3',
    'webpack-hot-middleware',
    'postcss',
    'consola',
    'ignore',
    // Implicit
    '@vue/compiler-core',
    '@vue/shared',
    'untyped'
  ],
  hooks: {
    // TODO: move to workspace root when https://github.com/unjs/unbuild/issues/195
    async 'build:done' () {
      for (const file of ['LICENSE', 'README.md']) {
        await copyFile(`../../${file}`, `./${file}`)
      }
    }
  },
})
