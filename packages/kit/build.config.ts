import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  emitCJS: false,
  entries: [
    {
      input: 'src/config/schema/index',
      outDir: 'schema',
      name: 'config',
      builder: 'untyped',
      defaults: {
        rootDir: '/project/'
      }
    },
    'src/index'
  ],
  externals: [
    'webpack',
    'vite',
    'nuxt',
    'nuxt3',
    // type imports
    '@vue/compiler-core',
    'vue-meta',
    'rollup-plugin-visualizer',
    'webpack-bundle-analyzer',
    'vue'
  ]
})
