import type { RolldownString } from 'rolldown-string'
import { generateTransform, rolldownString } from 'rolldown-string'
import { createUnplugin } from 'unplugin'
import { genImport } from 'knitwork'
import type { ESTree } from 'rolldown/utils'

import { VUE_ID_RE, VUE_TEMPLATE_ID_FILTER } from '../../core/utils/plugins.ts'
import { parseModule } from '../../core/utils/parse.ts'

const RENDER_LIST_RE = /renderList|ssrRenderList/
const RENDER_LIST_HELPERS = new Map([
  ['vue', 'renderList'],
  ['vue/server-renderer', 'ssrRenderList'],
])

export const RenderListPlugin = () => createUnplugin(() => {
  return {
    name: 'nuxt:render-list',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: [VUE_ID_RE, ...VUE_TEMPLATE_ID_FILTER] },
        code: { include: RENDER_LIST_RE },
      },
      handler (code, id, meta?: unknown) {
        let s: RolldownString | undefined

        for (const node of parseModule(code, id).program.body) {
          if (node.type !== 'ImportDeclaration' || node.importKind === 'type') {
            continue
          }
          const helper = RENDER_LIST_HELPERS.get(node.source.value)
          if (!helper) {
            continue
          }

          const named = node.specifiers.filter((specifier): specifier is ESTree.ImportSpecifier => specifier.type === 'ImportSpecifier')
          const specifier = named.find(specifier =>
            specifier.importKind !== 'type' &&
            (specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value) === helper,
          )
          if (!specifier) {
            continue
          }

          s ||= rolldownString(code, id, meta)
          const replacement = genImport('#app/components/render-list', [{ name: helper, as: specifier.local.name }])
          if (node.specifiers.length === 1) {
            s.overwrite(node.start, node.end, replacement)
            continue
          }
          const kept = named.filter(other => other !== specifier).map(other => code.slice(other.start, other.end))
          s.overwrite(named[0]!.start, named.at(-1)!.end, kept.join(', '))
          s.appendLeft(node.end, `\n${replacement}`)
        }

        return generateTransform(s, id)
      },
    },
  }
})
