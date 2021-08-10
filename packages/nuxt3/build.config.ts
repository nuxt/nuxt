import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: false,
  entries: [
    'src/index'
  ],
  dependencies: [
    '@nuxt/app',
    '@nuxt/vite-builder',
    '@nuxt/webpack-builder',
    'nuxi'
  ]
})
