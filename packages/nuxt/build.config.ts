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
  ]
})
