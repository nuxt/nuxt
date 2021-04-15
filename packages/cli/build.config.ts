import type { BuildConfig } from 'unbuild'

export default <BuildConfig>{
  declaration: false,
  inlineDependencies: true,
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/kit'
  ]
}
