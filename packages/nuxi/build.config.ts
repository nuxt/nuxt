import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  rollup: {
    inlineDependencies: true,
    cjsBridge: true
  },
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/kit',
    '@nuxt/schema',
    'fsevents',
    // TODO: Fix rollup/unbuild issue
    'node:buffer',
    'node:path',
    'node:child_process',
    'node:process',
    'node:path',
    'node:os'
  ]
})
