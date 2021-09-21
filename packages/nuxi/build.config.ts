import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  inlineDependencies: true,
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/kit',
    'fsevents'
  ]
})
