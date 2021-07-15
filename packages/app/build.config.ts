import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    { input: 'src/', name: 'app' }
  ],
  dependencies: [
    'ohmyfetch',
    'vue-router',
    'vuex5'
  ]
})
