import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'

const ENTRY_RE = /import ["']#build\/css["'];/

export const DynamicBasePlugin = createUnplugin(() => {
  return {
    name: 'nuxt:dynamic-base-path',
    enforce: 'post' as const,
    transform: {
      filter: {
        id: { include: /entry/ },
        code: { include: ENTRY_RE },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        s.prepend(`import { buildAssetsURL } from '#internal/nuxt/paths';\n__webpack_public_path__ = buildAssetsURL();\n`)
        return generateTransform(s, id)
      },
    },
  }
})
