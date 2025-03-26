import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'

interface DynamicBasePluginOptions {
  globalPublicPath?: string
  sourcemap?: boolean
}

const defaults: DynamicBasePluginOptions = {
  globalPublicPath: '__webpack_public_path__',
  sourcemap: true,
}

const ENTRY_RE = /import ["']#build\/css["'];/

export const DynamicBasePlugin = createUnplugin((options: DynamicBasePluginOptions = {}) => {
  options = { ...defaults, ...options }
  return {
    name: 'nuxt:dynamic-base-path',
    enforce: 'post' as const,
    transform (code, id) {
      if (!id.includes('entry') || !ENTRY_RE.test(code)) { return }
      const s = new MagicString(code)
      s.prepend(`import { buildAssetsURL } from '#internal/nuxt/paths';\n${options.globalPublicPath} = buildAssetsURL();\n`)
      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : undefined,
      }
    },
  }
})
