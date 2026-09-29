import { copyFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { defineConfig } from 'tsdown'
import { vueSfcPlugin } from 'vue-sfc-transformer/rolldown'

let distCleaned: Promise<void> | undefined
function cleanDist (outDir: string) {
  distCleaned ??= rm(outDir, { recursive: true, force: true })
  return distCleaned
}

const RUNTIME_TREES = [
  'src/app',
  'src/head/runtime',
  'src/components/runtime',
  'src/pages/runtime',
  'src/compiler/runtime',
  'src/runtime/server',
  'src/server',
]
const RUNTIME_ENTRY_GLOBS = RUNTIME_TREES.flatMap(tree => [
  `${tree}/**/*.ts`,
  `!${tree}/**/*.d.ts`,
])

const RUNTIME_NEVER_BUNDLE = [
  /^#app(\/|$)/,
  /^#build(\/|$)/,
  /^#internal(\/|$)/,
  /^#imports$/,
  /^#pages(\/|$)/,
  /^#unhead(\/|$)/,
  /^nuxt(\/|$)/,
  /^nitro(\/|$)/,
  /^nitropack(\/|$)/,
  '@nuxt/schema',
  '@vue/shared',
  '@unhead/vue',
  'vue',
  'vue-router',
  'vue-bundle-renderer',
  /^vue-bundle-renderer(\/|$)/,
]

export default defineConfig([
  {
    dts: { generator: 'oxc' },
    entry: 'src/index.ts',
    deps: {
      onlyBundle: [],
      neverBundle: [
        /^nuxt(\/|$)/,
        '@nuxt/schema',
        '@vue/shared',
        '@unhead/vue',
        'rolldown/experimental',
        'lightningcss',
      ],
    },
    clean: false,
    hooks: {
      'build:prepare': ({ options }) => cleanDist(options.outDir),
      'build:done': async ({ options }) => {
        // TODO: remove in Nuxt v5
        await Promise.all([
          copyFile(join(options.outDir, 'index.mjs'), join(options.outDir, 'index.js')),
          copyFile(join(options.outDir, 'index.d.mts'), join(options.outDir, 'index.d.ts')),
        ])
      },
    },
  },
  {
    unbundle: true,
    clean: false,
    hooks: {
      'build:prepare': ({ options }) => cleanDist(options.outDir),
    },
    // No `generator: 'oxc'`: it can't infer `defineDiagnostics()`'s return type, which the
    // diagnostics catalogs rely on. tsc handles it.
    dts: { sideEffects: true },
    // TODO: remove in Nuxt v5 to switch to `.mjs`
    fixedExtension: false,
    entry: RUNTIME_ENTRY_GLOBS,
    outDir: 'dist',
    plugins: [
      vueSfcPlugin({
        srcDir: 'src',
        cwd: import.meta.dirname,
        // Subpath path mappings relative to this package so vue-tsc can resolve
        // `#app`, `nuxt/app`, etc. when emitting declarations on a cold cache.
        tsconfig: './tsconfig.build.json',
        // Type-augmentation side-effect import from `src/app/index.ts`:
        // `./types/augments.ts` contains only `declare global` blocks and
        // would otherwise be tree-shaken out of the built JS.
        preserveSideEffectImports: [/(?:^|\/)types\/augments(?:\.[tj]s)?$/],
        // TODO: remove in Nuxt v5
        emitLegacyDeclarationAlias: true,
      }),
    ],
    deps: {
      neverBundle: true,
    },
    // `deps.neverBundle: true` only covers bare package specifiers and `node_modules`;
    // subpath imports and aliases resolved at Nuxt build time need to stay external too.
    inputOptions: {
      external: RUNTIME_NEVER_BUNDLE,
    },
  },
])
