import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: false,
  entries: [
    'src/index'
  ],
  dependencies: [
    '@nuxt/kit',
    '@vue/compiler-sfc',
    'vue'
  ]
})
