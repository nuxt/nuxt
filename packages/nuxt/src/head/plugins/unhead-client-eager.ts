import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { unheadVueComposablesImports } from '@unhead/vue'
import { parseAndWalk } from 'oxc-walker'
import { UNHEAD_TRANSFORM_ID_FILTER } from './unhead-imports.ts'

const INJECTING_ENTRIES = new Set(['@unhead/vue', '@unhead/vue/scripts', '@unhead/vue/components', '@unhead/vue/legacy'])
const NON_INJECTING_EXPORTS = new Set([
  ...unheadVueComposablesImports['@unhead/vue'],
  'createUnhead',
  'defineLink',
  'defineScript',
  'resolveUnrefHeadInput',
  'unheadVueComposablesImports',
])

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
        id: UNHEAD_TRANSFORM_ID_FILTER,
        code: { include: /@unhead\/vue/ },
      },
      handler (code, id, meta?: unknown) {
        let injects = false
        parseAndWalk(code, id, function (node) {
          if (injects) { return }
          if (node.type === 'ImportDeclaration') {
            if (node.importKind === 'type' || !INJECTING_ENTRIES.has(String(node.source.value))) { return }
            injects = node.specifiers.some(specifier =>
              specifier.type !== 'ImportSpecifier'
              || (specifier.importKind !== 'type' && !NON_INJECTING_EXPORTS.has(specifier.imported.type === 'Identifier' ? specifier.imported.name : String(specifier.imported.value))),
            )
          } else if ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source && node.exportKind !== 'type') {
            injects = INJECTING_ENTRIES.has(String(node.source.value))
          } else if (node.type === 'ImportExpression' && node.source.type === 'Literal') {
            injects = INJECTING_ENTRIES.has(String(node.source.value))
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
