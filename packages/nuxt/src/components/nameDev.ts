import { createUnplugin } from 'unplugin'
import type { Program } from 'acorn'
import MagicString from 'magic-string'
import type { Component } from 'nuxt/schema'
import { isVue } from '../core/utils'

interface NameDevPluginOptions {
  components: () => Component[]
}
/**
 * Set the default name of components to their PascalCase name
 */
export const nameDevPlugin = (options: NameDevPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:name-dev-plugin',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id) || !!id.match(/\.[tj]sx$/)
    },
    transform (code, id) {
      const component = options.components().find(c => c.filePath === id)

      if (!component) {
        return
      }

      const ast = this.parse(code) as Program
      const s = new MagicString(code)
      const defaultExport = ast.body.find(node => node.type === 'ExportDefaultDeclaration')

      if (defaultExport) {
        s.overwrite(defaultExport.declaration.start, defaultExport.declaration.end, `Object.assign(${code.slice(defaultExport.declaration.start, defaultExport.declaration.end)}, { __name: ${JSON.stringify(component.pascalName)} } )`)
        return {
          code: s.toString(),
        }
      }
    },
  }
})
