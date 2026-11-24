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
        // `module` needs no AST; `program` is only read for inline `type` specifiers below
        const parsed = parseModule(code, id)

        for (const declaration of parsed.module.staticImports) {
          const helper = RENDER_LIST_HELPERS.get(declaration.moduleRequest.value)
          if (!helper) {
            continue
          }

          const named = declaration.entries.filter(entry => entry.importName.kind === 'Name')
          const index = named.findIndex(entry => !entry.isType && entry.importName.name === helper)
          if (index === -1) {
            continue
          }

          s ||= rolldownString(code, id, meta)
          const replacement = genImport('#app/components/render-list', [{ name: helper, as: named[index]!.localName.value }])
          if (declaration.entries.length === 1) {
            s.overwrite(declaration.start, declaration.end, replacement)
            continue
          }
          // an entry's span starts at its name, so an inline `type` keyword is only covered by the AST
          const spans = named.some(entry => entry.isType)
            ? findImportDeclaration(parsed.program, declaration.start).specifiers
                .filter((specifier): specifier is ESTree.ImportSpecifier => specifier.type === 'ImportSpecifier')
                .map(specifier => [specifier.start, specifier.end] as const)
            : named.map(entry => [entry.importName.start!, entry.localName.end] as const)
          const kept = spans.filter((_, i) => i !== index).map(([start, end]) => code.slice(start, end))
          s.overwrite(spans[0]![0], spans.at(-1)![1], kept.join(', '))
          s.appendLeft(declaration.end, `\n${replacement}`)
        }

        return generateTransform(s, id)
      },
    },
  }
})

function findImportDeclaration (program: ESTree.Program, start: number) {
  return program.body.find((node): node is ESTree.ImportDeclaration => node.type === 'ImportDeclaration' && node.start === start)!
}
