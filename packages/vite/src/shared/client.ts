import type { Nuxt } from 'nuxt/schema'
import { join, resolve } from 'pathe'

import { getLayerDirectories } from '@nuxt/kit'

import { getTranspileStrings } from '../utils/transpile.ts'

/**
 * Collect optimizeDeps entry paths so that dependencies imported from layers
 * (e.g. CJS packages like slugify used in app.vue from a layer) are discovered
 * and pre-bundled. Without this, only the main app entry is scanned and
 * layer-only imports can fail in dev with "does not provide an export named 'default'".
 * @see https://github.com/nuxt/nuxt/issues/28631
 */
export function getOptimizeDepsEntries (nuxt: Nuxt, mainEntry: string): string[] {
  const entries: string[] = [mainEntry]
  const rootDirWithSlash = nuxt.options.rootDir + (nuxt.options.rootDir.endsWith('/') ? '' : '/')
  const srcDir = nuxt.options.srcDir

  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.app === srcDir || dirs.app.startsWith(rootDirWithSlash)) {
      continue
    }
    entries.push(
      join(dirs.app, '**/*.{vue,ts,tsx,js,jsx,mjs}'),
    )
  }

  return entries
}

export const clientEnvironment = (nuxt: Nuxt, entry: string) => {
  return {
    optimizeDeps: {
      entries: getOptimizeDepsEntries(nuxt, entry),
      include: [],
      // We exclude Vue and Nuxt common dependencies from optimization
      // as they already ship ESM.
      //
      // This will help to reduce the chance for users to encounter
      // common chunk conflicts that causing browser reloads.
      // We should also encourage module authors to add their deps to
      // `exclude` if they ships bundled ESM.
      //
      // Also since `exclude` is inert, it's safe to always include
      // all possible deps even if they are not used yet.
      //
      // @see https://github.com/antfu/nuxt-better-optimize-deps#how-it-works
      exclude: [
        // Vue
        'vue',
        '@vue/runtime-core',
        '@vue/runtime-dom',
        '@vue/reactivity',
        '@vue/shared',
        '@vue/devtools-api',
        '@vue/test-utils',
        'vue-router',
        'vue-demi',

        // Nuxt
        'nuxt',
        'nuxt/app',
        '@nuxt/test-utils',

        // Nuxt Deps
        '@unhead/vue',
        'consola',
        'defu',
        'devalue',
        'get-port-please',
        'h3',
        'hookable',
        'klona',
        'ofetch',
        'pathe',
        'ufo',
        'unctx',
        'unenv',

        // this will never be imported on the client
        '#app-manifest',
        // these should all be valid ESM
        '#imports',
        '#app',
        '#build',
        '#build/*',
        '#components',
        '#head',
        'virtual:nuxt:',
        'virtual:nuxt:*',
        ...getTranspileStrings({ isDev: nuxt.options.dev, isClient: true }),
      ],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(nuxt.options.vite.mode),
      'process.server': false,
      'process.client': true,
      'process.browser': true,
      'process.nitro': false,
      'process.prerender': false,
      'import.meta.server': false,
      'import.meta.client': true,
      'import.meta.browser': true,
      'import.meta.nitro': false,
      'import.meta.prerender': false,
      'module.hot': false,
      ...nuxt.options.experimental.clientNodeCompat ? { global: 'globalThis' } : {},
    },
    build: {
      sourcemap: nuxt.options.sourcemap.client ? nuxt.options.vite.build?.sourcemap ?? nuxt.options.sourcemap.client : false,
      manifest: 'manifest.json',
      outDir: resolve(nuxt.options.buildDir, 'dist/client'),
      rolldownOptions: {
        input: { entry },
      },
    },
  }
}
