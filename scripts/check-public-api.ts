import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

interface PublicEntrypoint {
  /**
   * Packages whose types may appear in the emitted declarations. Anything else is a type we do
   * not own, and therefore blocks us from changing the implementation of the utility that
   * exposes it without a breaking change.
   */
  types: string[]
  /**
   * Packages the declarations import for side effects only, with no bindings. These bring in no
   * names, but they do make the declarations depend on whatever that package augments, so they
   * are tracked separately rather than ignored.
   */
  augmentations?: string[]
}

const entrypoints: Record<string, PublicEntrypoint> = {
  'packages/kit/dist/index.d.mts': {
    types: [
      // Nuxt's own contract types. `@nuxt/schema` may itself depend on a third party where that
      // third party is the concept (Vite's config type for `nuxt.options.vite`, and so on).
      '@nuxt/schema',
      // TODO: the remaining leak. Handlers, route rules and the instance `useNitro()` hands out
      // are all the server builder's, resolved against whichever Nitro major is installed.
      // Describing them in Nuxt means widening them, and an interface for `@nuxt/nitro-server` to
      // augment would leave them untyped for anyone using `@nuxt/kit` on its own. To be resolved
      // when kit wraps the server builder rather than passing it through.
      'nitro/types',
      'nitropack/types',
    ],
    augmentations: [
      // Left over from bundling `pkg-types`' declarations, whose type-only imports of `exsolve`
      // are elided. `exsolve` is a hard dependency of kit, so consumers always have it.
      'exsolve',
    ],
  },
  // Schema describes configuration, so options that exist to configure a third party are typed
  // by that third party on purpose. Anything here that Nuxt could describe itself is a TODO.
  'packages/schema/dist/index.d.mts': {
    types: [
      // Bundlers, their plugins and loaders, and the Vue toolchain.
      'vite',
      '@vitejs/plugin-vue',
      '@vitejs/plugin-vue-jsx',
      'webpack',
      'webpack-bundle-analyzer',
      'webpack-dev-middleware',
      'webpack-hot-middleware',
      'css-minimizer-webpack-plugin',
      'mini-css-extract-plugin',
      'esbuild',
      'esbuild-loader',
      'oxc-transform',
      'rollup-plugin-visualizer',
      'vue-loader',
      'pug',
      'postcss',
      'autoprefixer',
      'cssnano',
      'vue',
      'vue-router',
      '@vue/compiler-core',
      '@vue/compiler-sfc',
      '@vue/language-core',
      '@unhead/vue/types',
      '@unhead/vue/vite',
      // Options passed straight through to the library they configure.
      'chokidar',
      'compatx',
      'unctx/transform',
      'h3',
      // `TSConfig` models `tsconfig.json`, which is TypeScript's format rather than Nuxt's.
      'pkg-types',
      // `SchemaDefinition` and `Schema` are `untyped`'s schema format, which Nuxt exposes
      // deliberately through `$schema` and `defineNuxtSchema`.
      'untyped',
      // `imports:context` hands out the auto-import transformer instance. An escape hatch, in the
      // same category as `useNitro()`.
      'unimport',
    ],
    augmentations: [
      '@unhead/vue',
      '@unhead/vue/server',
      'vue-bundle-renderer/runtime',
      'nitro/h3',
      'hookable',
    ],
  },
  // `@nuxt/schema/builder-env` declares `ImportMeta` globally, so anything it pulls in lands in
  // every consuming project's global scope. It describes the bundler's `import.meta` inline
  // today, and the empty list is what keeps it that way.
  'packages/schema/dist/builder-env.d.mts': {
    types: [],
  },
}

/** Patterns that bind a name, and so put a package's types in our public surface. */
const typeImportPatterns = [
  // `import … from` and `export … from`, including a bare `export *`
  /^\s*(?:import|export)\s[^'"]*\sfrom\s["']([^"']+)["'];?$/gm,
  // an inline `import(…)` type
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  // a triple-slash `reference types` directive
  /\/\/\/\s*<reference\s+types="([^"]+)"\s*\/>/g,
]

/** A bare import with no bindings, which still pulls in the package's augmentations. */
const augmentationPatterns = [/^\s*import\s+["']([^"']+)["'];?$/gm]

const root = new URL('../', import.meta.url)

function specifiersMatching (contents: string, patterns: RegExp[]) {
  const specifiers = new Set<string>()
  for (const re of patterns) {
    for (const match of contents.matchAll(re)) {
      const specifier = match[1]!
      if (!specifier.startsWith('.') && !specifier.startsWith('node:')) {
        specifiers.add(specifier)
      }
    }
  }
  return specifiers
}

let failed = false

for (const [file, entrypoint] of Object.entries(entrypoints)) {
  const path = fileURLToPath(new URL(file, root))
  if (!existsSync(path)) {
    console.error(`[check-public-api] ${file} not found. Run \`pnpm build\` first.`)
    process.exit(1)
  }

  const contents = readFileSync(path, 'utf8')
  const found = {
    types: specifiersMatching(contents, typeImportPatterns),
    augmentations: specifiersMatching(contents, augmentationPatterns),
  }

  for (const kind of ['types', 'augmentations'] as const) {
    const allowed = entrypoint[kind] ?? []
    const unexpected = [...found[kind]].filter(specifier => !allowed.includes(specifier)).sort()
    if (!unexpected.length) { continue }

    failed = true
    const description = kind === 'types'
      ? 'leaks types from packages that are not on the allowlist'
      : 'depends on augmentations from packages that are not on the allowlist'
    console.error(`[check-public-api] ${file} ${description}:`)
    for (const specifier of unexpected) {
      console.error(`  - ${specifier}`)
    }
    console.error(`Inline the types, or add the package to \`${kind}\` in scripts/check-public-api.ts with a rationale.`)
  }
}

if (failed) {
  process.exit(1)
}

console.debug('[check-public-api] no unexpected external types in public declarations')
