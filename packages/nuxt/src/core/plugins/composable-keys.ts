import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { hash } from 'ohash'
import { parseQuery, parseURL } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { findStaticImports, parseStaticImport } from 'mlly'
import { ScopeTracker, parseAndWalk, walk } from 'oxc-walker'
import { resolvePath } from '@nuxt/kit'
import type { KeyedComposable } from '@nuxt/schema'
import { logger } from '../../utils.ts'
import type { CallExpression, Node } from 'oxc-parser'

import { matchWithStringOrRegex } from '../utils/plugins'

interface ComposableKeysOptions {
  sourcemap: boolean
  composables: KeyedComposable[]
}

const stringTypes: Array<string | undefined> = ['Literal', 'TemplateLiteral']
const NUXT_LIB_RE = /node_modules\/(?:nuxt|nuxt3|nuxt-nightly|@nuxt)\//
const SUPPORTED_EXT_RE = /\.(?:m?[jt]sx?|vue)/
const SCRIPT_RE = /(?<=<script[^>]*>)[\s\S]*?(?=<\/script>)/i

export function shouldTransformFile (id: string, extensions: RegExp | readonly string[]) {
  const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  return !NUXT_LIB_RE.test(pathname)
    && (
      extensions instanceof RegExp
        ? extensions.test(pathname)
        : new RegExp(`\\.(${extensions.join('|')})$`).test(pathname)
    )
    && parseQuery(search).type !== 'style' && !parseQuery(search).macro
}

export const ComposableKeysPlugin = (options: ComposableKeysOptions) => createUnplugin(() => {
  const composableMeta: Record<string, any> = {}
  const composableLengths = new Set<number>()
  const keyedFunctions = new Set<string>()
  for (const { name, ...meta } of options.composables) {
    composableMeta[name] = meta
    keyedFunctions.add(name)
    composableLengths.add(meta.argumentLength)
  }

  const maxLength = Math.max(...composableLengths)
  const KEYED_FUNCTIONS_RE = new RegExp(`\\b(${[...keyedFunctions].map(f => escapeRE(f)).join('|')})\\b`)

  return {
    name: 'nuxt:composable-keys',
    enforce: 'post',
    transformInclude: id => shouldTransformFile(id, SUPPORTED_EXT_RE),
    transform: {
      filter: {
        code: { include: KEYED_FUNCTIONS_RE },
      },
      async handler (code, id) {
        const { 0: script = code, index: codeIndex = 0 } = code.match(SCRIPT_RE) || { index: 0, 0: code }
        const s = new MagicString(code)
        let count = 0

        function isNodeKeyedComposableCallExpression (node: Node): node is CallExpression & { callee: { type: 'Identifier' } } {
          return node.type === 'CallExpression' && node.callee.type === 'Identifier'
            && !!node.callee.name && keyedFunctions.has(node.callee.name) && node.arguments.length < maxLength
        }

        // To handle variable hoisting, we need a pre-pass to collect variable and function declarations with scope info.
        const scopeTracker = new ScopeTracker({
          preserveExitedScopes: true,
        })

        let hasKeyedComposableCallExpression: boolean = false

        const parseResult = parseAndWalk(script, id, {
          scopeTracker,
          enter (node) {
            if (!hasKeyedComposableCallExpression && isNodeKeyedComposableCallExpression(node)) {
              hasKeyedComposableCallExpression = true
            }
          },
        })

        scopeTracker.freeze()

        if (!hasKeyedComposableCallExpression) { return }

        const imports = await detectImportNames(script, composableMeta)

        walk(parseResult.program, {
          scopeTracker,
          enter (node) {
            if (!isNodeKeyedComposableCallExpression(node)) { return }
            const name = node.callee.name
            // do not inject keys for imported functions unless their `src` path matches
            if (imports.has(name)) { return }

            const meta = composableMeta[name]
            const declaration = scopeTracker.getDeclaration(name)

            // skip key injection for locally defined functions
            if (declaration && declaration.type !== 'Import') {
              let skip = true
              if (meta.source) {
                // if we're not processing the file defined in the `source` property of the keyed composable entry
                // TODO: remove support for regex sources in Nuxt 5
                skip = !matchWithStringOrRegex(id, meta.source)
              }

              if (skip) { return }
            }

            if (node.arguments.length >= meta.argumentLength) { return }

            switch (name) {
              case 'useState':
                if (stringTypes.includes(node.arguments[0]?.type)) { return }
                break

              case 'useFetch':
              case 'useLazyFetch':
                if (stringTypes.includes(node.arguments[1]?.type)) { return }
                break

              case 'useAsyncData':
              case 'useLazyAsyncData':
                if (stringTypes.includes(node.arguments[0]?.type) || stringTypes.includes(node.arguments[node.arguments.length - 1]?.type)) { return }
                break
            }

            // TODO: Optimize me (https://github.com/nuxt/framework/pull/8529)
            const newCode = code.slice(codeIndex + node.start, codeIndex + node.end - 1).trim()
            const endsWithComma = newCode[newCode.length - 1] === ','

            s.appendLeft(
              codeIndex + node.end - 1,
              (node.arguments.length && !endsWithComma ? ', ' : '') + '\'$' + hash(`${id}-${++count}`).slice(0, 10) + '\'',
            )
          },
        })
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

const NUXT_IMPORT_RE = /nuxt|#app|#imports/

export async function detectImportNames (code: string, composableMeta: Record<string, Pick<KeyedComposable, 'source'>>) {
  const names = new Set<string>()

  async function addName (name: string, specifier: string) {
    const source = composableMeta[name]?.source

    if (typeof source === 'string') {
      try {
        const importedFileRelativePath = await resolvePath(specifier, { fallbackToOriginal: true })

        if (importedFileRelativePath === source) { return }
      } catch (e) {
        logger.error('[nuxt] [composable-keys] Could not resolve import specifier while detecting keyed composables.', e)
      }
      // TODO: remove support for regex sources in Nuxt 5
    } else if (source && matchWithStringOrRegex(specifier, source)) {
      return
    }
    names.add(name)
  }

  for (const i of findStaticImports(code)) {
    if (NUXT_IMPORT_RE.test(i.specifier)) { continue }

    const { namedImports = {}, defaultImport, namespacedImport } = parseStaticImport(i)
    for (const name in namedImports) {
      await addName(namedImports[name]!, i.specifier)
    }
    if (defaultImport) {
      await addName(defaultImport, i.specifier)
    }
    if (namespacedImport) {
      await addName(namespacedImport, i.specifier)
    }
  }
  return names
}
