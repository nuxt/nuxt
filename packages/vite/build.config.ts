import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  emitCJS: false,
  entries: [
    'src/index'
  ],
  dependencies: [
    '@nuxt/kit',
    'vue'
  ]
})
