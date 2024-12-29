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
        srcDir: '/<srcDir>/',
        workspaceDir: '/<workspaceDir>/',
        rootDir: '/<rootDir>/',
        vite: {
          base: '/',
        },
      },
    },
    'src/index',
    'src/builder-env',
  ],
  hooks: {
    'rollup:options' (ctx, options) {
      ctx.options.rollup.dts.respectExternal = false
      const isExternal = options.external! as (id: string, importer?: string, isResolved?: boolean) => boolean
      options.external = (source, importer, isResolved) => {
        if (source === 'untyped' || source === 'knitwork') {
          return false
        }
        return isExternal(source, importer, isResolved)
      }
    },
  },
  externals: [
    // Type imports
    'nuxt/app',
    'cssnano',
    'autoprefixer',
    'ofetch',
    'vue-router',
    'vue-bundle-renderer',
    '@unhead/schema',
    'vue',
    'unctx',
    'hookable',
    'nitro',
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
    '@vue/language-core',
    // Implicit
    '@vue/compiler-core',
    '@vue/compiler-sfc',
    '@vue/shared',
    'untyped',
  ],
})
