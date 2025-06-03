import type { BuildEntry } from 'unbuild'
import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin, stubOptions } from '../../debug/build-config'

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
      'pages',
    ].map(name => ({ input: `src/${name}/runtime/`, outDir: `dist/${name}/runtime`, format: 'esm', ext: 'js' } as BuildEntry)),
  ],
  stubOptions,
  hooks: {
    'mkdist:entry:options' (_ctx, _entry, mkdistOptions) {
      mkdistOptions.addRelativeDeclarationExtensions = true
    },
    'rollup:options' (ctx, options) {
      addRollupTimingsPlugin(options)
    },
  },
  dependencies: [
    '@nuxt/cli',
    'vue-router',
    'ofetch',
  ],
  externals: [
    'vite',
    'nuxt',
    'nuxt/schema',
    '@vue/shared',
    '@unhead/vue',
  ],
})
