import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/schema',
    'nitropack',
    'webpack',
    'vite',
    'h3'
  ]
})
