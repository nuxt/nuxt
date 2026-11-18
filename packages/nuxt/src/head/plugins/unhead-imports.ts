import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { Identifier, ImportSpecifier } from 'estree'
import { normalize, relative } from 'pathe'
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

export const UNHEAD_EAGER_TRANSFORM_ID_FILTER = {
  include: [...VUE_SCRIPT_ID_FILTER, JS_ID_RE],
  exclude: [VUE_NON_SCRIPT_BLOCK_RE, DIST_DIR_RE, UNHEAD_LIB_RE, NUXT_HEAD_RE],
}

const UNHEAD_TRANSFORM_ID_FILTER = {
  include: UNHEAD_EAGER_TRANSFORM_ID_FILTER.include,
  exclude: [...UNHEAD_EAGER_TRANSFORM_ID_FILTER.exclude, /^virtual:/],
}

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
        id: UNHEAD_TRANSFORM_ID_FILTER,
        code: { include: UnheadVueRE },
      },
      async handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        const unheadSpecifiers: ImportSpecifier[] = []
        const headSpecifiers: ImportSpecifier[] = []
        parseAndWalk(code, id, function (node) {
          if (node.type !== 'ImportDeclaration') { return }
          const source = String(node.source.value)
          if (source === UnheadVue) {
            unheadSpecifiers.push(...node.specifiers as ImportSpecifier[])
            s.remove(node.start, node.end)
          } else if (source === '#app/composables/head') {
            headSpecifiers.push(...node.specifiers as ImportSpecifier[])
            s.remove(node.start, node.end)
          }
        })

        if (!unheadSpecifiers.length && !headSpecifiers.length) {
          return generateTransform(s, id)
        }

        const { unheadVueComposablesImports } = await import('@unhead/vue')
        const composablesFromUnhead = unheadSpecifiers.filter(specifier => unheadVueComposablesImports[UnheadVue].includes((specifier.imported as Identifier)?.name))
        const unheadOnlySpecifiers = unheadSpecifiers.filter(specifier => !unheadVueComposablesImports[UnheadVue].includes((specifier.imported as Identifier)?.name))
        if (composablesFromUnhead.length) {
          // warn if user has imported from @unhead/vue themselves
          if (!normalize(id).includes('node_modules')) {
            headDiagnostics.NUXT_B6001({ module: UnheadVue, file: link(normalize(id), { cwd: options.rootDir, formatter: absolute => `./${relative(normalize(options.rootDir), absolute)}` }) })
          }
        }
        const importsToAddFromHead = [...composablesFromUnhead, ...headSpecifiers]
        if (importsToAddFromHead.length) {
          s.prepend(`${genImport('#app/composables/head', toImports(importsToAddFromHead))}\n`)
        }
        if (unheadOnlySpecifiers.length) {
          s.prepend(`${genImport(UnheadVue, toImports(unheadOnlySpecifiers))}\n`)
        }

        return generateTransform(s, id)
      },
    },
  }
})
