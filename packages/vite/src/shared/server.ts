import type { Nuxt } from 'nuxt/schema'
import { resolve } from 'pathe'
import type { EnvironmentOptions } from 'vite'
import { useNitro } from '@nuxt/kit'
import escapeStringRegexp from 'escape-string-regexp'
import { withTrailingSlash } from 'ufo'

import { getTranspilePatterns, getTranspileStrings } from '../utils/transpile.ts'

export function ssr (nuxt: Nuxt) {
  return {
    external: [
      'nitro/runtime',
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
        input: { server: serverEntry },
        external: [
          'nitro/runtime',
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
    resolve: {
      conditions: useNitro().options.exportConditions,
    },
  } satisfies EnvironmentOptions
}
