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
    '@unhead/schema',
    '@vitejs/plugin-vue',
    '@vitejs/plugin-vue-jsx',
    '@vue/language-core',
    'autoprefixer',
    'c12',
    'compatx',
    'consola',
    'css-minimizer-webpack-plugin',
    'cssnano',
    'esbuild-loader',
    'file-loader',
    'h3',
    'hookable',
    'ignore',
    'mini-css-extract-plugin',
    'nitro',
    'nitropack',
    'nuxt/app',
    'ofetch',
    'pkg-types',
    'postcss',
    'pug',
    'rollup-plugin-visualizer',
    'sass-loader',
    'scule',
    'unctx',
    'unimport',
    'vite',
    'vue',
    'vue-bundle-renderer',
    'vue-loader',
    'vue-router',
    'webpack',
    'webpack-bundle-analyzer',
    'webpack-dev-middleware',
    'webpack-hot-middleware',
    // Implicit
    '@vue/compiler-core',
    '@vue/compiler-sfc',
    '@vue/shared',
  ],
})
