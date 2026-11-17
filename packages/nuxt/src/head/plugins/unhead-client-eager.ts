import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { unheadVueComposablesImports } from '@unhead/vue'
import { parseAndWalk } from 'oxc-walker'
import type { ESTree } from 'rolldown/utils'
import { UNHEAD_EAGER_TRANSFORM_ID_FILTER } from './unhead-imports.ts'

const INJECTING_ENTRIES = new Set(['@unhead/vue', '@unhead/vue/client', '@unhead/vue/scripts', '@unhead/vue/components', '@unhead/vue/legacy'])
const PURE_EXPORTS = new Set([
  'createHead',
  'createUnhead',
  'defineLink',
  'defineScript',
  'renderDOMHead',
  'resolveUnrefHeadInput',
  'unheadVueComposablesImports',
])
// imports of these composables outside virtual modules are rewritten to Nuxt's own by `UnheadImportsPlugin`; re-exports are not
const NON_INJECTING_IMPORTS = new Set([...unheadVueComposablesImports['@unhead/vue'], ...PURE_EXPORTS])

function specifierName (node: { type: string, name?: string, value?: unknown }) {
  return node.type === 'Identifier' ? node.name! : String(node.value)
}

function staticString (node: ESTree.Node): string | undefined {
  if (node.type === 'Literal') { return typeof node.value === 'string' ? node.value : undefined }
  if (node.type === 'TemplateLiteral' && !node.expressions.length) { return node.quasis[0]?.value.cooked ?? undefined }
}

function isTypeOnlyPosition (parent: ESTree.Node | null) {
  return !!parent?.type.startsWith('TS') && parent.type !== 'TSExternalModuleReference'
}

interface UnheadClientEagerPluginOptions {
  eagerEntry: string
}

/**
 * Lets the lazily created client head be provided through Vue's injection to
 * modules that read it via `@unhead/vue` directly rather than through Nuxt's composables.
 */
export const UnheadClientEagerPlugin = (options: UnheadClientEagerPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:head:client-eager',
    transform: {
      filter: {
        id: UNHEAD_EAGER_TRANSFORM_ID_FILTER,
        code: { include: /@unhead\/vue/ },
      },
      handler (code, id, meta?: unknown) {
        let injects = false
        const nonInjectingImports = id.startsWith('virtual:') ? PURE_EXPORTS : NON_INJECTING_IMPORTS
        const classifiedSources = new Set<ESTree.Node>()
        parseAndWalk(code, id, function (node, parent) {
          if (injects) { return }
          if (node.type === 'ImportDeclaration') {
            classifiedSources.add(node.source)
            if (node.importKind === 'type' || !INJECTING_ENTRIES.has(String(node.source.value))) { return }
            injects = node.specifiers.some(specifier =>
              specifier.type !== 'ImportSpecifier'
              || (specifier.importKind !== 'type' && !nonInjectingImports.has(specifierName(specifier.imported))),
            )
          } else if (node.type === 'ExportNamedDeclaration' && node.source) {
            classifiedSources.add(node.source)
            injects = node.exportKind !== 'type' && INJECTING_ENTRIES.has(String(node.source.value))
              && node.specifiers.some(specifier => specifier.exportKind !== 'type' && !PURE_EXPORTS.has(specifierName(specifier.local)))
          } else if (node.type === 'ExportAllDeclaration') {
            classifiedSources.add(node.source)
            injects = node.exportKind !== 'type' && INJECTING_ENTRIES.has(String(node.source.value))
          } else if (!classifiedSources.has(node) && !isTypeOnlyPosition(parent)) {
            // any other reference to an entry, such as a dynamic import or `require()`
            const value = staticString(node)
            injects = value !== undefined && INJECTING_ENTRIES.has(value)
          }
        })
        if (!injects) { return }

        const s = rolldownString(code, id, meta)
        s.prepend(`import ${JSON.stringify(options.eagerEntry)};\n`)
        return generateTransform(s, id)
      },
    },
  }
})
