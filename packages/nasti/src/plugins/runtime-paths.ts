import MagicString from 'magic-string'
import type { NastiPlugin } from '@nasti-toolchain/nasti'

// Asset URL placeholders the runtime resolves via `globalThis.__publicAssetsURL`. The
// `__NASTI_*` names mirror Vite's `__VITE_ASSET__` / `__VITE_PUBLIC_ASSET__` convention; if
// Nasti emits a different token, update these.
const NASTI_ASSET_RE = /__NASTI_ASSET__|__NASTI_PUBLIC_ASSET__/
const CSS_RE = /\.(?:css|s[ac]ss|less|styl|stylus|pcss|postcss)(?:$|\?)/
const STYLE_QUERY_RE = /[?&]type=style/

/**
 * Ensures modules referencing built `__NASTI_ASSET__` placeholders depend on
 * `#internal/nuxt/paths` (which sets `globalThis.__publicAssetsURL`). Client environment
 * only. Mirrors `@nuxt/vite-builder`'s `RuntimePathsPlugin`.
 */
export function RuntimePathsPlugin (): NastiPlugin {
  return {
    name: 'nuxt:nasti:runtime-paths',
    enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    transform (code, id) {
      const [pathname, search = ''] = id.split('?') as [string, string?]

      // Skip CSS, and <style> blocks of Vue SFCs.
      if (CSS_RE.test(pathname)) {
        return
      }
      if (pathname.endsWith('.vue') && STYLE_QUERY_RE.test(search)) {
        return
      }

      if (!NASTI_ASSET_RE.test(code)) {
        return
      }

      const s = new MagicString(code)
      s.prepend('import "#internal/nuxt/paths";\n')
      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}
