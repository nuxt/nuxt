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
    'src/builder-env'
  ],
  externals: [
    // Type imports
    '#app/components/nuxt-link',
    'ofetch',
    'vue-router',
    '@nuxt/telemetry',
    'vue-bundle-renderer',
    '@unhead/schema',
    'vue',
    'unctx',
    'hookable',
    'nitropack',
    'webpack',
    'webpack-bundle-analyzer',
    'rollup-plugin-visualizer',
    'vite',
    '@vitejs/plugin-vue',
    '@vitejs/plugin-vue-jsx',
    'mini-css-extract-plugin',
    'css-minimizer-webpack-plugin',
    'webpack-dev-middleware',
    'h3',
    'webpack-hot-middleware',
    'postcss',
    'consola',
    'ignore',
    'vue-loader',
    'esbuild-loader',
    'file-loader',
    'pug',
    'sass-loader',
    'c12',
    // Implicit
    '@vue/compiler-core',
    '@vue/shared',
    'untyped'
  ]
})
