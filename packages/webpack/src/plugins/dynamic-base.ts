import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'

interface DynamicBasePluginOptions {
  globalPublicPath?: string
  sourcemap?: boolean
}

const defaults: DynamicBasePluginOptions = {
  globalPublicPath: '__webpack_public_path__',
  sourcemap: true
}

export const DynamicBasePlugin = createUnplugin((options: DynamicBasePluginOptions = {}) => {
  options = { ...defaults, ...options }
  return {
    name: 'nuxt:dynamic-base-path',
    enforce: 'post',
    transform (code, id) {
      if (!id.includes('paths.mjs') || !code.includes('const appConfig = ')) {
        return
      }
      const s = new MagicString(code)
      s.append(`${options.globalPublicPath} = buildAssetsURL();\n`)
      return {
        code: s.toString(),
        map: options.sourcemap && s.generateMap({ source: id, includeContent: true })
      }
    }
  }
})
