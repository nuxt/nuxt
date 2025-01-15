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
    'nitropack',
    'webpack',
    'vite',
    'h3',
  ],
})
