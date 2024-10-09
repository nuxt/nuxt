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
    'nitro',
    'webpack',
    'vite',
    'h3',
  ],
})
