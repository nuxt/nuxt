import type { Nuxt } from 'nuxt/schema'
import { resolve } from 'pathe'
import type { EnvironmentOptions } from 'vite'
import escapeStringRegexp from 'escape-string-regexp'
import { withTrailingSlash } from 'ufo'

import { getTranspilePatterns, getTranspileStrings } from '../utils/transpile.ts'

export function ssr (nuxt: Nuxt) {
  return {
    external: [
      'nitro/runtime-config',
      // TODO: remove in v5
      '#internal/nitro',
      '#internal/nitro/utils',
    ],
    noExternal: [
      ...getTranspilePatterns({ isServer: true, isDev: nuxt.options.dev }),
      '/__vue-jsx',
      '#app',
      /^nuxt(\/|$)/,
      /(nuxt|nuxt3|nuxt-nightly)\/(dist|src|app)/,
      // vue-onigiri's runtime imports `virtual:onigiri/manifest` which
      // only Vite's plugin chain can resolve. Marking it external
      // would hand the import to Node, which doesn't understand the
      // `virtual:` scheme and crashes at request time.
      'vue-onigiri',
    ],
  }
}

export function ssrEnvironment (nuxt: Nuxt, serverEntry: string) {
  return {
    build: {
      // we'll display this in nitro build output
      reportCompressedSize: false,
      sourcemap: nuxt.options.sourcemap.server ? nuxt.options.vite.build?.sourcemap ?? nuxt.options.sourcemap.server : false,
      outDir: resolve(nuxt.options.buildDir, 'dist/server'),
      ssr: true,
      rolldownOptions: {
        input: {
          server: serverEntry,
          'components.islands': resolve(nuxt.options.buildDir, 'components.islands'),
        },
        external: [
          'nitro/runtime-config',
          // TODO: remove in v5
          '#internal/nitro',
          'nitropack/runtime',
          '#internal/nuxt/paths',
          '#internal/nuxt/app-config',
          '#app-manifest',
          '#shared',
          new RegExp('^' + escapeStringRegexp(withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))),
        ],
        output: {
          entryFileNames: '[name].mjs',
          format: 'module',
        },
        onwarn (warning, rollupWarn) {
          if (warning.code && 'UNUSED_EXTERNAL_IMPORT' === warning.code) {
            return
          }
          rollupWarn(warning)
        },
      },
    },
    define: {
      'process.server': true,
      'process.client': false,
      'process.browser': false,
      'import.meta.server': true,
      'import.meta.client': false,
      'import.meta.browser': false,
      'window': 'undefined',
      'document': 'undefined',
      'navigator': 'undefined',
      'location': 'undefined',
      'XMLHttpRequest': 'undefined',
    },
    optimizeDeps: {
      noDiscovery: true,
      include: undefined,
      exclude: getTranspileStrings({ isDev: nuxt.options.dev, isClient: false }),
    },
  } satisfies EnvironmentOptions
}
