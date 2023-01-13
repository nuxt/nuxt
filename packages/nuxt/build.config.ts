import { copyFile } from 'node:fs/promises'
import type { BuildEntry } from 'unbuild'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    // Core
    { input: 'src/index' },
    // App
    { input: 'src/app/', outDir: 'dist/app/' },
    // Runtime dirs
    ...[
      'core',
      'head',
      'components',
      'pages'
    ].map(name => ({ input: `src/${name}/runtime/`, outDir: `dist/${name}/runtime`, format: 'esm' } as BuildEntry))
  ],
  dependencies: [
    'nuxi',
    'vue-router',
    'ofetch'
  ],
  externals: [
    '@vue/reactivity',
    '@vue/shared',
    '@vueuse/head'
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
