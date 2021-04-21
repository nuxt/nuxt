import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    { input: 'src/', name: 'app' }
  ],
  dependencies: [
    '@vueuse/head',
    'ohmyfetch',
    'vue-router',
    'vuex5'
  ]
})
