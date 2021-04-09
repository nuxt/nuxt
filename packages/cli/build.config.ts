import type { BuildConfig } from 'unbuild'

export default <BuildConfig>{
  declaration: false,
  entries: [
    'src/index'
  ],
  externals: [
    'nuxt3'
  ]
}
