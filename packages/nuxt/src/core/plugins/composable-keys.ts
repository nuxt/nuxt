import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { isAbsolute, relative, resolve } from 'pathe'
import MagicString from 'magic-string'
import { hash } from 'ohash'
import { parseQuery, parseURL } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { findStaticImports, parseStaticImport } from 'mlly'
import { ScopeTracker, parseAndWalk, walk } from 'oxc-walker'
import { resolveAlias } from '@nuxt/kit'

import { matchWithStringOrRegex } from '../utils/plugins'

interface ComposableKeysOptions {
  sourcemap: boolean
  rootDir: string
  srcDir: string
  composables: Array<{ name: string, source?: string | RegExp, argumentLength: number }>
}

const stringTypes: Array<string | undefined> = ['Literal', 'TemplateLiteral']
const NUXT_LIB_RE = /node_modules\/(?:nuxt|nuxt3|nuxt-nightly)\//
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
      handler (code, id) {
        const { 0: script = code, index: codeIndex = 0 } = code.match(SCRIPT_RE) || { index: 0, 0: code }
        const s = new MagicString(code)
        // https://github.com/unjs/unplugin/issues/90
        let imports: Set<string> | undefined
        let count = 0
        const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id
        const { pathname: relativePathname } = parseURL(relativeID)

        // To handle variables hoisting we need a pre-pass to collect variable and function declarations with scope info.
        const scopeTracker = new ScopeTracker({
          preserveExitedScopes: true,
        })
        const parseResult = parseAndWalk(script, id, {
          scopeTracker,
        })

        scopeTracker.freeze()

        walk(parseResult.program, {
          scopeTracker,
          enter (node) {
            if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') { return }
            const name = node.callee.name
            if (!name || !keyedFunctions.has(name) || node.arguments.length >= maxLength) { return }

            // do not inject keys for imported functions unless their `src` path matches
            imports ||= detectImportNames(script, composableMeta, id, options.srcDir)
            if (imports.has(name)) { return }

            const meta = composableMeta[name]

            const declaration = scopeTracker.getDeclaration(name)

            if (declaration && declaration.type !== 'Import') {
              let skip = true
              if (meta.source) {
                skip = !matchWithStringOrRegex(relativePathname, meta.source)
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
              (node.arguments.length && !endsWithComma ? ', ' : '') + '\'$' + hash(`${relativeID}-${++count}`).slice(0, 10) + '\'',
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

export function detectImportNames (code: string, composableMeta: Record<string, { source?: string | RegExp }>, importerPath: string, srcDir: string) {
  const names = new Set<string>()

  function normalizePathToRelative (path: string) {
    let resolved = isAbsolute(path) ? path : undefined
    const aliasResolved = resolveAlias(path)
    if (isAbsolute(aliasResolved)) {
      resolved = aliasResolved
    } else {
      resolved = resolve(srcDir, path)
    }

    const noExt = resolved.replace(/\.[^/.]+$/, '')
    return relative(srcDir, noExt)
  }

  function addName (name: string, specifier: string) {
    const source = composableMeta[name]?.source

    if (typeof source === 'string') {
      try {
        const importedFileRelativePath = normalizePathToRelative(specifier)
        const sourceRelativePath = normalizePathToRelative(source)

        if (importedFileRelativePath === sourceRelativePath) { return }
      } catch (e) {
        console.error('[nuxt] Could not resolve import specifier while detecting keyed composables.', e)
      }
    } else if (source && matchWithStringOrRegex(specifier, source)) {
      return
    }
    names.add(name)
  }

  for (const i of findStaticImports(code)) {
    if (NUXT_IMPORT_RE.test(i.specifier)) { continue }

    const { namedImports = {}, defaultImport, namespacedImport } = parseStaticImport(i)
    for (const name in namedImports) {
      addName(namedImports[name]!, i.specifier)
    }
    if (defaultImport) {
      addName(defaultImport, i.specifier)
    }
    if (namespacedImport) {
      addName(namespacedImport, i.specifier)
    }
  }
  return names
}
