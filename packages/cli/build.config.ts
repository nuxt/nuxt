import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: false,
  inlineDependencies: true,
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/kit',
    'fsevents'
  ]
})
