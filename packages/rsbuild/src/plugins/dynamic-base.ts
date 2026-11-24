import type { RsbuildPlugin } from '@rsbuild/core'
import { generateTransform, rolldownString } from 'rolldown-string'

const ENTRY_RE = /import ["']#build\/css["'];/

/**
 * Resolve chunks and assets relative to the runtime `app.buildAssetsDir` (and `app.cdnURL`).
 */
export function DynamicBasePlugin (): RsbuildPlugin {
  return {
    name: 'nuxt:dynamic-base-path',
    setup (api) {
      api.transform({ test: /entry/, order: 'post' }, ({ code, resourcePath }) => {
        if (!ENTRY_RE.test(code)) {
          return code
        }
        const s = rolldownString(code, resourcePath)
        s.prepend(`import { buildAssetsURL } from '#internal/nuxt/paths';\n__webpack_public_path__ = buildAssetsURL();\n`)
        return generateTransform(s, resourcePath) ?? code
      })
    },
  }
}
