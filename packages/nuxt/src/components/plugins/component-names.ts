import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Component } from 'nuxt/schema'
import { parseAndWalk, withLocations } from '../../core/utils/parse'

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
      /* v8 ignore next 2 */
      return isVue(id) || !!id.match(SX_RE)
    },
    transform: {
      filter: {
        id: { include: FILENAME_RE },
      },
      handler (code, id) {
        const filename = id.match(FILENAME_RE)![1]!
        const component = options.getComponents().find(c => c.filePath === id)

        if (!component) {
          return
        }

        const NAME_RE = new RegExp(`__name:\\s*['"]${filename}['"]`)
        const s = new MagicString(code)
        s.replace(NAME_RE, `__name: ${JSON.stringify(component.pascalName)}`)

        // Without setup function, vue compiler does not generate __name
        if (!s.hasChanged()) {
          parseAndWalk(code, id, function (node) {
            if (node.type !== 'ExportDefaultDeclaration') {
              return
            }

            const { start, end } = withLocations(node.declaration)
            s.overwrite(start, end, `Object.assign(${code.slice(start, end)}, { __name: ${JSON.stringify(component.pascalName)} })`)
            this.skip()
          })
        }

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap
              /* v8 ignore next */
              ? s.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },
  }
})
