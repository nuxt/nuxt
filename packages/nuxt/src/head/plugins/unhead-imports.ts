import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { Identifier, ImportSpecifier } from 'estree'
import { normalize, relative } from 'pathe'
import { unheadVueComposablesImports } from '@unhead/vue'
import { genImport } from 'knitwork'
import { parseAndWalk } from 'oxc-walker'
import { headDiagnostics } from '@nuxt/kit/internal'
import { link } from 'clickable-path'
import escapeStringRegexp from 'escape-string-regexp'
import { JS_ID_RE, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER } from '../../core/utils/index.ts'
import { distDir } from '../../dirs.ts'

const DIST_DIR_RE = new RegExp('^' + escapeStringRegexp(normalize(distDir)).replace(/\//g, '[\\\\/]'))

interface UnheadImportsPluginOptions {
  rootDir: string
}

const UNHEAD_LIB_RE = /node_modules[/\\](?:@unhead[/\\][^/\\]+|unhead)[/\\]/
const NUXT_HEAD_RE = /node_modules[/\\]nuxt[/\\]dist[/\\]head[/\\]runtime[/\\]/

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
    transform: {
      filter: {
        id: {
          include: [...VUE_SCRIPT_ID_FILTER, JS_ID_RE],
          exclude: [VUE_NON_SCRIPT_BLOCK_RE, /^virtual:/, DIST_DIR_RE, UNHEAD_LIB_RE, NUXT_HEAD_RE],
        },
        code: { include: UnheadVueRE },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        const importsToAdd: ImportSpecifier[] = []
        parseAndWalk(code, id, function (node) {
          if (node.type === 'ImportDeclaration' && [UnheadVue, '#app/composables/head'].includes(String(node.source.value))) {
            importsToAdd.push(...node.specifiers as ImportSpecifier[])
            const { start, end } = node
            s.remove(start, end)
          }
        })

        const importsFromUnhead = importsToAdd.filter(specifier => unheadVueComposablesImports[UnheadVue].includes((specifier.imported as Identifier)?.name))
        const importsFromHead = importsToAdd.filter(specifier => !unheadVueComposablesImports[UnheadVue].includes((specifier.imported as Identifier)?.name))
        if (importsFromUnhead.length) {
          // warn if user has imported from @unhead/vue themselves
          if (!normalize(id).includes('node_modules')) {
            headDiagnostics.NUXT_B6001({ module: UnheadVue, file: link(normalize(id), { cwd: options.rootDir, formatter: absolute => `./${relative(normalize(options.rootDir), absolute)}` }) })
          }
          s.prepend(`${genImport('#app/composables/head', toImports(importsFromUnhead))}\n`)
        }
        if (importsFromHead.length) {
          s.prepend(`${genImport(UnheadVue, toImports(importsFromHead))}\n`)
        }

        return generateTransform(s, id)
      },
    },
  }
})
