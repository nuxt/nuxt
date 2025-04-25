import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Identifier, ImportSpecifier } from 'estree'
import { normalize, relative } from 'pathe'
import { unheadVueComposablesImports } from '@unhead/vue'
import { genImport } from 'knitwork'
import { parseAndWalk, withLocations } from '../../core/utils/parse'
import { isJS, isVue } from '../../core/utils'
import { distDir } from '../../dirs'
import { logger } from '../../utils'

interface UnheadImportsPluginOptions {
  sourcemap: boolean
  rootDir: string
}

const UNHEAD_LIB_RE = /node_modules[/\\](?:@unhead[/\\][^/\\]+|unhead)[/\\]/

function toImports (specifiers: ImportSpecifier[]) {
  return specifiers.map((specifier) => {
    const imported = specifier.imported as Identifier | null
    const isNamedImport = imported && imported.name !== specifier.local.name
    return isNamedImport ? `${imported.name} as ${specifier.local.name}` : specifier.local.name
  })
}

const UnheadVue = '@unhead/vue'
const UnheadVueRE = /@unhead\/vue/

/**
 * To use composable in an async context we need to pass Nuxt context to the Unhead composables.
 *
 * We swap imports from @unhead/vue to #app/composables/head and warn users for type safety.
 */
export const UnheadImportsPlugin = (options: UnheadImportsPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:head:unhead-imports',
    enforce: 'post',
    transformInclude (id) {
      id = normalize(id)
      return (
        (isJS(id) || isVue(id, { type: ['script'] })) &&
        !id.startsWith('virtual:') &&
        !id.startsWith(normalize(distDir)) &&
        !UNHEAD_LIB_RE.test(id)
      )
    },
    transform: {
      filter: {
        code: { include: UnheadVueRE },
      },
      handler (code, id) {
        const s = new MagicString(code)
        const importsToAdd: ImportSpecifier[] = []
        parseAndWalk(code, id, function (node) {
          if (node.type === 'ImportDeclaration' && [UnheadVue, '#app/composables/head'].includes(String(node.source.value))) {
            importsToAdd.push(...node.specifiers as ImportSpecifier[])
            const { start, end } = withLocations(node)
            s.remove(start, end)
          }
        })

        const importsFromUnhead = importsToAdd.filter(specifier => unheadVueComposablesImports[UnheadVue].includes((specifier.imported as Identifier)?.name))
        const importsFromHead = importsToAdd.filter(specifier => !unheadVueComposablesImports[UnheadVue].includes((specifier.imported as Identifier)?.name))
        if (importsFromUnhead.length) {
          // warn if user has imported from @unhead/vue themselves
          if (!normalize(id).includes('node_modules')) {
            logger.warn(`You are importing from \`${UnheadVue}\` in \`./${relative(normalize(options.rootDir), normalize(id))}\`. Please import from \`#imports\` instead for full type safety.`)
          }
          s.prepend(`${genImport('#app/composables/head', toImports(importsFromUnhead))}\n`)
        }
        if (importsFromHead.length) {
          s.prepend(`${genImport(UnheadVue, toImports(importsFromHead))}\n`)
        }

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap
              ? s.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },
  }
})
