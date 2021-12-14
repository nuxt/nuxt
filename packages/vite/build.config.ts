import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  dependencies: [
    'vue'
  ],
  externals: [
    '@nuxt/schema'
  ]
})
