import type { BuildEntry } from 'unbuild'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    // Core
    { input: 'src/index' },
    // App
    { input: 'src/app/', outDir: 'dist/app/', ext: 'js' },
    // Runtime dirs
    ...[
      'core',
      'head',
      'components',
      'pages'
    ].map(name => ({ input: `src/${name}/runtime/`, outDir: `dist/${name}/runtime`, format: 'esm', ext: 'js' } as BuildEntry))
  ],
  hooks: {
    'mkdist:entry:options' (_ctx, _entry, mkdistOptions) {
      mkdistOptions.addRelativeDeclarationExtensions = true
    }
  },
  dependencies: [
    'nuxi',
    'vue-router',
    'ofetch'
  ],
  externals: [
    'nuxt',
    'nuxt/schema',
    '@vue/reactivity',
    '@vue/shared',
    '@unhead/vue'
  ]
})
