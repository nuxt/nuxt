import * as vite from 'vite'
import type { Nuxt } from 'nuxt/schema'
import { transpile } from '../utils/transpile'
import { resolve } from 'pathe'
import type { EnvironmentOptions } from 'vite'
import { useNitro } from '@nuxt/kit'
import escapeStringRegexp from 'escape-string-regexp'
import { withTrailingSlash } from 'ufo'

export function ssr (nuxt: Nuxt) {
  return {
    external: [
      'nitro/runtime',
      // TODO: remove in v5
      '#internal/nitro',
      '#internal/nitro/utils',
    ],
    noExternal: [
      ...transpile({ isServer: true, isDev: nuxt.options.dev }),
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
      rollupOptions: {
        input: { server: serverEntry },
        external: [
          'nitro/runtime',
          // TODO: remove in v5
          '#internal/nitro',
          'nitropack/runtime',
          '#internal/nuxt/paths',
          '#app-manifest',
          '#shared',
          new RegExp('^' + escapeStringRegexp(withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))),
        ],
        output: {
          entryFileNames: '[name].mjs',
          format: 'module',
          ...((vite as any).rolldownVersion
          // Wait for https://github.com/rolldown/rolldown/issues/206
            ? {}
            : {
                generatedCode: {
                  symbols: true, // temporary fix for https://github.com/vuejs/core/issues/8351,
                  constBindings: true,
                  // temporary fix for https://github.com/rollup/rollup/issues/5975
                  arrowFunctions: true,
                },
              }),
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
    resolve: {
      conditions: useNitro().options.exportConditions,
    },
  } satisfies EnvironmentOptions
}
