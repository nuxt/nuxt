import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Component } from 'nuxt/schema'
import { isVue } from '../../core/utils'

interface NameDevPluginOptions {
  sourcemap: boolean
  getComponents: () => Component[]
}
/**
 * Set the default name of components to their PascalCase name
 */
export const ComponentNamePlugin = (options: NameDevPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:component-name-plugin',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id) || !!id.match(/\.[tj]sx$/)
    },
    transform (code, id) {
      const filename = id.match(/([^/\\]+)\.\w+$/)?.[1]
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
