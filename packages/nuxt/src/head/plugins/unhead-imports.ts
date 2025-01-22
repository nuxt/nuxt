import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { ImportSpecifier } from 'estree'
import { relative } from 'pathe'
import { unheadVueComposablesImports } from '@unhead/vue'
import { parseAndWalk, withLocations } from '../../core/utils/parse'
import { isJS, isVue } from '../../core/utils'
import { distDir } from '../../dirs'
import { logger } from '../../utils'

interface UnheadImportsPluginOptions {
  sourcemap: boolean
  rootDir: string
}

const UNHEAD_LIB_RE = /node_modules\/(?:@unhead\/[^/]+|unhead)\//

function toImports (specifiers: ImportSpecifier[]) {
  return specifiers.map((specifier) => {
    const isNamedImport = specifier.imported && specifier.imported.name !== specifier.local.name
    return isNamedImport ? `${specifier.imported.name} as ${specifier.local.name}` : specifier.local.name
  })
}

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
      return (isJS(id) || isVue(id, { type: ['script'] })) && !id.startsWith(distDir) && !UNHEAD_LIB_RE.test(id)
    },
    transform (code, id) {
      if (!code.includes('@unhead/vue')) {
        return
      }
      const s = new MagicString(code)
      const importsToAdd: ImportSpecifier[] = []
      // Without setup function, vue compiler does not generate __name
      parseAndWalk(code, id, function (node) {
        // find any imports from @unhead/vue, swap the matchImports for an import from #app/composables/head
        if (node.type === 'ImportDeclaration' && ['@unhead/vue', '#app/composables/head'].includes(node.source.value)) {
          importsToAdd.push(...node.specifiers as ImportSpecifier[])
          const { start, end } = withLocations(node)
          s.remove(start, end)
        }
      })

      const importsFromUnhead = importsToAdd.filter(specifier => unheadVueComposablesImports['@unhead/vue'].includes(specifier.imported.name))
      const importsFromHead = importsToAdd.filter(specifier => !unheadVueComposablesImports['@unhead/vue'].includes(specifier.imported.name))
      if (importsFromUnhead.length) {
        // warn if user has imported from @unhead/vue themselves
        if (!id.includes('node_modules')) {
          logger.warn(`You are importing from \`@unhead/vue\` in \`./${relative(options.rootDir, id)}\`. Please import from \`#app\` instead for full type safety.`)
        }
        s.prepend(`import { ${toImports(importsFromUnhead).join(', ')} } from '#app/composables/head'\n`)
      }
      // if there are imports from #app/composables/head, add an import from @unhead/vue
      if (importsFromHead.length) {
        s.prepend(`import { ${toImports(importsFromHead).join(', ')} } from '@unhead/vue'\n`)
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
  }
})
