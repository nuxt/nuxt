import { copyFile } from 'node:fs/promises'
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
  ],
  hooks: {
    // TODO: move to workspace root when https://github.com/unjs/unbuild/issues/195
    async 'build:done' () {
      for (const file of ['LICENSE', 'README.md']) {
        await copyFile(`../../${file}`, `./${file}`)
      }
    }
  }
})
