import { pathToFileURL } from 'node:url'
import MagicString from 'magic-string'
import { parseQuery, parseURL } from 'ufo'
import type { Plugin } from 'vite'

export interface RuntimePathsOptions {
  sourcemap?: boolean
}

const VITE_ASSET_RE = /__VITE_ASSET__|__VITE_PUBLIC_ASSET__/
const JS_RE = /\.((c|m)?j|t)sx?$/

export function runtimePathsPlugin (options: RuntimePathsOptions): Plugin {
  return {
    name: 'nuxt:runtime-paths-dep',
    enforce: 'post',
    transform (code, id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      if (pathname.endsWith('.vue')) {
        // vue files
        if (search && parseQuery(search).type !== 'script') {
          return
        }
      } else if (!JS_RE.test(pathname)) {
        return
      }
      if (VITE_ASSET_RE.test(code)) {
        const s = new MagicString(code)
        // Register dependency on paths.mjs, which sets globalThis.__publicAssetsURL
        s.prepend('import "#build/paths.mjs";')

        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }
}
