import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { parseAndWalk } from 'oxc-walker'

import { SX_RE, isVue } from '../../core/utils/index.ts'
import type { Component } from 'nuxt/schema'

interface NameDevPluginOptions {
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
      handler (code, id, meta?: unknown) {
        const filename = id.match(FILENAME_RE)?.[1]
        if (!filename) {
          return
        }
        const component = options.getComponents().find(c => c.filePath === id)

        if (!component) {
          return
        }

        const NAME_RE = new RegExp(`__name:\\s*['"]${filename}['"]`)
        const s = rolldownString(code, id, meta)
        const nameMatch = NAME_RE.exec(code)
        if (nameMatch) {
          s.overwrite(nameMatch.index, nameMatch.index + nameMatch[0].length, `__name: ${JSON.stringify(component.pascalName)}`)
        }

        // Without setup function, vue compiler does not generate __name
        if (!nameMatch) {
          parseAndWalk(code, id, function (node) {
            if (node.type !== 'ExportDefaultDeclaration') {
              return
            }

            const { start, end } = node.declaration
            s.overwrite(start, end, `Object.assign(${code.slice(start, end)}, { __name: ${JSON.stringify(component.pascalName)} })`)
            this.skip()
          })
        }

        return generateTransform(s, id)
      },
    },
  }
})
