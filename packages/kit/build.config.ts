import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  rollup: {
    inlineDependencies: ['lodash-es'],
  },
  externals: [
    '@rspack/core',
    '@nuxt/schema',
    'nitro',
    'nitropack',
    'webpack',
    'vite',
    'h3',
    'unimport',
  ],
})
