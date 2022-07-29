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
    'src/index'
  ],
  externals: [
    // Type imports
    'vue-meta',
    'vue-router',
    'vue',
    'hookable',
    'nitropack',
    'webpack',
    'pkg-types',
    'webpack-bundle-analyzer',
    'rollup-plugin-visualizer',
    'vite',
    '@vitejs/plugin-vue',
    'mini-css-extract-plugin',
    'terser-webpack-plugin',
    'css-minimizer-webpack-plugin',
    'webpack-dev-middleware',
    'webpack-hot-middleware',
    'postcss',
    'consola',
    'ignore',
    // Implicit
    '@vue/compiler-core',
    '@vue/shared'
  ]
})
