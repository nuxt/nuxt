import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  externals: [
    '@nuxt/schema',
    'nitropack',
    'nitro',
    'webpack',
    'vite',
    'h3',
  ],
})
