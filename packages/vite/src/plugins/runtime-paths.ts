import { generateTransform, rolldownString } from 'rolldown-string'
import type { Plugin } from 'vite'

const VITE_ASSET_RE = /__VITE_ASSET__|__VITE_PUBLIC_ASSET__/
const CSS_PATH_RE = /^[^?]*\.(?:css|scss|sass|postcss|pcss|less|stylus|styl)(?:\?|$)/
const VUE_STYLE_RE = /\.vue\?(?:.*&)?type=style/

export function RuntimePathsPlugin (): Plugin {
  return {
    name: 'nuxt:runtime-paths-dep',
    enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    transform: {
      filter: {
        // skip imports into css files and `<style>` blocks of vue files
        id: { exclude: [CSS_PATH_RE, VUE_STYLE_RE] },
        code: VITE_ASSET_RE,
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        // Register dependency on #build/paths.mjs or #internal/nuxt/paths.mjs, which sets globalThis.__publicAssetsURL
        s.prepend('import "#internal/nuxt/paths";')

        return generateTransform(s, id)
      },
    },
  }
}
