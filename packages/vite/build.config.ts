import type { BuildConfig } from 'unbuild'

export default <BuildConfig>{
  declaration: false,
  entries: [
    'src/index'
  ],
  dependencies: [
    '@nuxt/kit',
    '@vue/compiler-sfc',
    'vue'
  ]
}
