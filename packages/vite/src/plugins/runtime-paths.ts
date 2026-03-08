import MagicString from 'magic-string'
import type { Plugin } from 'vite'
import { isCSS, parseModuleId } from '../utils/index.ts'

const VITE_ASSET_RE = /__VITE_ASSET__|__VITE_PUBLIC_ASSET__/
const STYLE_QUERY_RE = /[?&]type=style/

export function RuntimePathsPlugin (): Plugin {
  let sourcemap: boolean
  return {
    name: 'nuxt:runtime-paths-dep',
    enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    configResolved (config) {
      sourcemap = !!config.build.sourcemap
    },
    transform (code, id) {
      const { pathname, search } = parseModuleId(id)

      // skip import into css files
      if (isCSS(pathname)) { return }

      // skip import into <style> vue files
      if (pathname.endsWith('.vue')) {
        if (STYLE_QUERY_RE.test(search)) { return }
      }

      if (VITE_ASSET_RE.test(code)) {
        const s = new MagicString(code)
        // Register dependency on #build/paths.mjs or #internal/nuxt/paths.mjs, which sets globalThis.__publicAssetsURL
        s.prepend('import "#internal/nuxt/paths";')

        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }
}
