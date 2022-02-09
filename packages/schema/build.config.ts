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
        rootDir: '/<rootDir>/'
      }
    },
    'src/index'
  ],
  externals: [
    // Type imports
    'vue-meta',
    'vue',
    'hookable',
    'webpack',
    'pkg-types',
    'webpack-bundle-analyzer',
    'rollup-plugin-visualizer',
    'vite',
    // Implicit
    '@vue/compiler-core',
    '@vue/shared'
  ]
})
