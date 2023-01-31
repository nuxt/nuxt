import MagicString from 'magic-string'
import type { Plugin } from 'vite'

export interface RuntimePathsOptions {
  sourcemap?: boolean
}

const VITE_ASSET_RE = /__VITE_ASSET__|__VITE_PUBLIC_ASSET__/

export function runtimePathsPlugin (options: RuntimePathsOptions): Plugin {
  return {
    name: 'nuxt:runtime-paths-dep',
    enforce: 'post',
    transform (code, id) {
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
