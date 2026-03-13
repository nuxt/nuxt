import type { Nuxt } from 'nuxt/schema'
import { resolve } from 'pathe'

import { getTranspileStrings } from '../utils/transpile.ts'

export const clientEnvironment = (nuxt: Nuxt, entry: string) => {
  return {
    optimizeDeps: {
      entries: [entry],
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
