import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Component } from 'nuxt/schema'
import { SX_RE, isVue } from '../../core/utils'

interface NameDevPluginOptions {
  sourcemap: boolean
  getComponents: () => Component[]
}
const FILENAME_RE = /([^/\\]+)\.\w+$/
/**
 * Set the default name of components to their PascalCase name
 */
export const ComponentNamePlugin = (options: NameDevPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:component-name-plugin',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id) || !!id.match(SX_RE)
    },
    transform (code, id) {
      const filename = id.match(FILENAME_RE)?.[1]
      if (!filename) {
        return
      }

      const component = options.getComponents().find(c => c.filePath === id)

      if (!component) {
        return
      }

      const NAME_RE = new RegExp(`__name:\\s*['"]${filename}['"]`)
      const s = new MagicString(code)
      s.replace(NAME_RE, `__name: ${JSON.stringify(component.pascalName)}`)

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }
})
