import { defineBuildConfig, BuildEntry } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    // Core
    { input: 'src/index' },
    // App
    { input: 'src/app/', outDir: 'dist/app/' },
    // Runtime dirs
    ...[
      'meta',
      'pages'
    ].map(name => ({ input: `src/${name}/runtime/`, outDir: `dist/${name}/runtime`, format: 'esm' } as BuildEntry))
  ],
  dependencies: [
    'nuxi',
    'vue-router',
    'ohmyfetch'
  ],
  externals: [
    '@vue/reactivity',
    '@vue/shared',
    '@vueuse/head'
  ]
})
