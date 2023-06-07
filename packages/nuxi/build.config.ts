import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  rollup: {
    inlineDependencies: true,
    resolve: {
      exportConditions: ['production', 'node'] as any
    }
  },
  entries: [
    'src/cli',
    'src/cli-run',
    'src/cli-wrapper',
    'src/index'
  ],
  externals: [
    '@nuxt/kit',
    '@nuxt/schema',
    '@nuxt/test-utils',
    'fsevents',
    // TODO: Fix rollup/unbuild issue
    'node:url',
    'node:buffer',
    'node:path',
    'node:child_process',
    'node:process',
    'node:path',
    'node:os'
  ]
})
