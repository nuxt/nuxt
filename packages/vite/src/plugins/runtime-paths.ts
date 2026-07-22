import { generateTransform, rolldownString } from 'rolldown-string'
import type { Plugin } from 'vite'
import { isCSS, parseModuleId } from '../utils/index.ts'

const VITE_ASSET_RE = /__VITE_ASSET__|__VITE_PUBLIC_ASSET__/
const STYLE_QUERY_RE = /[?&]type=style/

export function RuntimePathsPlugin (): Plugin {
  return {
    name: 'nuxt:runtime-paths-dep',
    enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    transform (code, id, meta?: unknown) {
      const { pathname, search } = parseModuleId(id)

      // skip import into css files
      if (isCSS(pathname)) { return }

      // skip import into <style> vue files
      if (pathname.endsWith('.vue')) {
        if (STYLE_QUERY_RE.test(search)) { return }
      }

      if (VITE_ASSET_RE.test(code)) {
        const s = rolldownString(code, id, meta)
        // Register dependency on #build/paths.mjs or #internal/nuxt/paths.mjs, which sets globalThis.__publicAssetsURL
        s.prepend('import "#internal/nuxt/paths";')

        return generateTransform(s, id)
      }
    },
  }
}
