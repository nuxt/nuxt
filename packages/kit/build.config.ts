import { copyFile } from 'node:fs/promises'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  externals: [
    '@nuxt/schema',
    'nitropack',
    'webpack',
    'vite',
    'h3'
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
