import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  externals: [
    '@rspack/core',
    '@nuxt/schema',
    'nitropack',
    'webpack',
    'vite',
    'h3',
  ],
  failOnWarn: false,
})
