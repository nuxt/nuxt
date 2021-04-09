import { BuildConfig } from 'unbuild'

export default <BuildConfig>{
  declaration: false,
  entries: [
    { input: 'src/', name: 'app' }
  ],
  dependencies: [
    '@vueuse/head',
    'ohmyfetch',
    'vue-router',
    'vuex5'
  ]
}
