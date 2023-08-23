import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Nuxt } from '@nuxt/schema'
import type { Node } from 'estree-walker'
import { walk } from 'estree-walker'
import type { BlockStatement } from 'estree'
import { isVue } from '../utils'

export const AsyncContextInjectionPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:async-context-injection',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform (code) {
      const s = new MagicString(code)

      let importName: string

      walk(this.parse(code) as Node, {
        enter (node) {
          // only interested in calls of defineComponent function
          if (node.type === 'ImportDeclaration' && node.source.value === 'vue') {
            importName = importName ?? node.specifiers.find(s => s.type === 'ImportSpecifier' && s.imported.name === 'defineComponent')?.local.name
          }
          // we only want to transform `async setup()` functions
          if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === importName) {
            walk(node, {
              enter (setup) {
                if (setup.type === 'Property' && setup.key.type === 'Identifier' && setup.key.name === 'setup') {
                  if (setup.value.type === 'FunctionExpression' && setup.value.async) {
                    const body: BlockStatement = setup.value.body
                    const { start, end } = body as BlockStatement & { start: number, end: number }
                    s.appendLeft(start, '{ return useNuxtApp().runWithContext(async () => ')
                    s.appendRight(end, ') }')
                  }
                }
              }
            })
          }
        }
      })

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
