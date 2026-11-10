import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'

import { SX_RE, VUE_ID_FILTER } from '../../core/utils/index.ts'
import { assignDefaultExportName } from '../utils.ts'
import type { Component } from 'nuxt/schema'

interface NameDevPluginOptions {
  getComponents: () => Component[]
}
const FILENAME_RE = /([^/\\]+)\.\w+$/
/**
 * Set the default name of components to their PascalCase name
 */
export const ComponentNamePlugin = (options: NameDevPluginOptions) => createUnplugin(() => {
  const indexes = new WeakMap<Component[], { length: number, byPath: Map<string, Component> }>()
  return {
    name: 'nuxt:component-name-plugin',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: [...VUE_ID_FILTER, SX_RE] },
      },
      handler (code, id, meta?: unknown) {
        const filename = id.match(FILENAME_RE)?.[1]
        if (!filename) {
          return
        }
        const components = options.getComponents()
        let index = indexes.get(components)
        if (!index || index.length !== components.length) {
          const byPath = new Map<string, Component>()
          for (const component of components) {
            if (!byPath.has(component.filePath)) {
              byPath.set(component.filePath, component)
            }
          }
          index = { length: components.length, byPath }
          indexes.set(components, index)
        }
        const component = index.byPath.get(id)

        if (!component) {
          return
        }

        const NAME_RE = new RegExp(`__name:\\s*['"]${filename}['"]`)
        const s = rolldownString(code, id, meta)
        const nameMatch = NAME_RE.exec(code)
        if (nameMatch) {
          s.overwrite(nameMatch.index, nameMatch.index + nameMatch[0].length, `__name: ${JSON.stringify(component.pascalName)}`)
        } else {
          // Without setup function, vue compiler does not generate __name
          assignDefaultExportName(code, id, s, component.pascalName)
        }

        return generateTransform(s, id)
      },
    },
  }
})
