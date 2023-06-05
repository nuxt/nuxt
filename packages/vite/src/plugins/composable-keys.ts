import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { isAbsolute, relative } from 'pathe'
import type { Node } from 'estree-walker'
import { walk } from 'estree-walker'
import MagicString from 'magic-string'
import { hash } from 'ohash'
import type { CallExpression } from 'estree'
import { parseQuery, parseURL } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { findStaticImports, parseStaticImport } from 'mlly'

export interface ComposableKeysOptions {
  sourcemap: boolean
  rootDir: string
  composables: Array<{ name: string, argumentLength: number }>
}

const stringTypes = ['Literal', 'TemplateLiteral']
const NUXT_LIB_RE = /node_modules\/nuxt3?\//
const SUPPORTED_EXT_RE = /\.(m?[jt]sx?|vue)/

export const composableKeysPlugin = createUnplugin((options: ComposableKeysOptions) => {
  const composableMeta = Object.fromEntries(options.composables.map(({ name, ...meta }) => [name, meta]))

  const maxLength = Math.max(...options.composables.map(({ argumentLength }) => argumentLength))
  const keyedFunctions = new Set(options.composables.map(({ name }) => name))
  const KEYED_FUNCTIONS_RE = new RegExp(`\\b(${[...keyedFunctions].map(f => escapeRE(f)).join('|')})\\b`)

  return {
    name: 'nuxt:composable-keys',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return !NUXT_LIB_RE.test(pathname) && SUPPORTED_EXT_RE.test(pathname) && parseQuery(search).type !== 'style' && !parseQuery(search).macro
    },
    transform (code, id) {
      if (!KEYED_FUNCTIONS_RE.test(code)) { return }
      const { 0: script = code, index: codeIndex = 0 } = code.match(/(?<=<script[^>]*>)[\S\s.]*?(?=<\/script>)/) || { index: 0, 0: code }
      const s = new MagicString(code)
      // https://github.com/unjs/unplugin/issues/90
      let imports: Set<string> | undefined
      let count = 0
      const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id
      walk(this.parse(script, {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }) as Node, {
        enter (_node) {
          if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
          const node: CallExpression = _node as CallExpression
          const name = 'name' in node.callee && node.callee.name
          if (!name || !keyedFunctions.has(name) || node.arguments.length >= maxLength) { return }

          imports = imports || detectImportNames(script)
          if (imports.has(name)) { return }

          const meta = composableMeta[name]

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
          const endsWithComma = code.slice(codeIndex + (node as any).start, codeIndex + (node as any).end - 1).trim().endsWith(',')

          s.appendLeft(
            codeIndex + (node as any).end - 1,
            (node.arguments.length && !endsWithComma ? ', ' : '') + "'$" + hash(`${relativeID}-${++count}`) + "'"
          )
        }
      })
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})

const NUXT_IMPORT_RE = /nuxt|#app|#imports/

function detectImportNames (code: string) {
  const imports = findStaticImports(code)
  const names = new Set<string>()
  for (const i of imports) {
    if (NUXT_IMPORT_RE.test(i.specifier)) { continue }
    const { namedImports, defaultImport, namespacedImport } = parseStaticImport(i)
    for (const name in namedImports || {}) {
      names.add(namedImports![name])
    }
    if (defaultImport) {
      names.add(defaultImport)
    }
    if (namespacedImport) {
      names.add(namespacedImport)
    }
  }
  return names
}
