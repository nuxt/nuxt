import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  inlineDependencies: true,
  emitCJS: false,
  cjsBridge: true,
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/kit',
    'fsevents'
  ]
})
