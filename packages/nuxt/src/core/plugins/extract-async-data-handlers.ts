import { pathToFileURL } from 'node:url'
import type { SourceMapInput } from 'rollup'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { dirname } from 'pathe'
import { parseQuery, parseURL } from 'ufo'
import { ScopeTracker, parseAndWalk, walk } from 'oxc-walker'
import type { ArrowFunctionExpression, Function } from 'oxc-parser'

const functionsToExtract = new Set(['useAsyncData', 'useLazyAsyncData'])
const FUNCTIONS_RE = /\buse(?:Lazy)?AsyncData\b/
const SUPPORTED_EXT_RE = /\.(?:m?[jt]sx?|vue)$/
const SCRIPT_RE = /(?<=<script[^>]*>)[\s\S]*?(?=<\/script>)/i

export interface ExtractAsyncDataHandlersOptions {
  sourcemap: boolean
  rootDir: string
}

export const ExtractAsyncDataHandlersPlugin = (options: ExtractAsyncDataHandlersOptions) => createUnplugin(() => {
  const asyncDatas: Record<string, { code: string, map?: SourceMapInput }> = {}

  let count = 0

  return {
    name: 'nuxt:extract-async-data-handlers',
    enforce: 'post',
    resolveId (source) {
      if (source in asyncDatas) {
        return source
      }
    },
    load (id) {
      if (id in asyncDatas) {
        return asyncDatas[id]
      }
    },
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return SUPPORTED_EXT_RE.test(pathname) && parseQuery(search).type !== 'style' && !parseQuery(search).macro
    },
    transform: {
      filter: {
        id: {
          exclude: [/nuxt\/(src|dist)\/app/],
        },
        code: { include: FUNCTIONS_RE },
      },
      handler (code, id) {
        const { 0: script = code, index: codeIndex = 0 } = code.match(SCRIPT_RE) || { index: 0, 0: code }

        let s: MagicString | undefined

        const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })
        const parseResult = parseAndWalk(script, id, { scopeTracker })
        scopeTracker.freeze()

        walk(parseResult.program, {
          scopeTracker,
          enter (node) {
            if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || !functionsToExtract.has(node.callee.name)) {
              return
            }

            const callExpression = node

            const fetcherFunction = callExpression.arguments.find((fn): fn is Function | ArrowFunctionExpression => fn.type === 'ArrowFunctionExpression' || fn.type === 'FunctionExpression')

            if (!fetcherFunction || (fetcherFunction.type !== 'ArrowFunctionExpression' && fetcherFunction.type !== 'FunctionExpression') || !fetcherFunction.body) {
              return
            }

            s ||= new MagicString(code)

            const referencedVariables = new Set<string>()
            const imports = new Set<string>()

            // Walk the function body to find all identifiers
            walk(fetcherFunction.body, {
              scopeTracker,
              enter (innerNode, parent) {
                if (innerNode.type !== 'Identifier') {
                  return
                }

                // Skip identifiers that are property keys (not variable references)
                if (parent) {
                  // Skip non-computed member expression properties (e.g., the "data" in response.data)
                  if (parent.type === 'MemberExpression' && parent.property === innerNode && parent.computed === false) {
                    return
                  }
                  // Skip non-computed object property keys (e.g., { data: value })
                  if (parent.type === 'Property' && parent.key === innerNode && parent.computed === false) {
                    return
                  }
                  // Skip non-computed class method keys
                  if (parent.type === 'MethodDefinition' && parent.key === innerNode && parent.computed === false) {
                    return
                  }
                  // Skip non-computed property definition keys
                  if (parent.type === 'PropertyDefinition' && parent.key === innerNode && parent.computed === false) {
                    return
                  }
                }

                const declaration = scopeTracker.getDeclaration(innerNode.name)
                if (!declaration) {
                  return
                }

                if (declaration.type === 'Import') {
                  // This is an imported variable, we need to include the import
                  imports.add(innerNode.name)
                } else if (declaration.type !== 'FunctionParam') {
                  const functionBodyStart = fetcherFunction.body!.start
                  const functionBodyEnd = fetcherFunction.body!.end

                  // If the declaration is not within the function body, it's external
                  if (declaration.start < functionBodyStart || declaration.end > functionBodyEnd) {
                    referencedVariables.add(innerNode.name)
                  }
                }
              },
            })

            // Collect import statements for the referenced imports
            const importStatements = new Set<string>()
            walk(parseResult.program, {
              enter (importDecl) {
                if (importDecl.type !== 'ImportDeclaration') {
                  return
                }

                // Check if this import declaration contains any of our referenced imports
                if (importDecl.specifiers?.some(spec => spec.local && imports.has(spec.local.name))) {
                  importStatements.add(script.slice(importDecl.start, importDecl.end))
                }
              },
            })

            const imps = Array.from(importStatements).join('\n')

            // Generate a unique key for the extracted chunk
            const key = `${dirname(id)}/async-data-chunk-${count++}.js`

            // Get the function body content
            const isBlockStatement = fetcherFunction.body.type === 'BlockStatement'

            const startOffset = codeIndex + fetcherFunction.body.start
            const endOffset = codeIndex + fetcherFunction.body.end

            // Create the extracted chunk
            const chunk = s.clone()
            const parameters = [...referencedVariables].join(', ')
            const returnPrefix = isBlockStatement ? '' : 'return '
            const preface = `${imps}\nexport default async function (${parameters}) { ${returnPrefix}`
            const suffix = ` }`

            if (isBlockStatement) {
              // For block statements, we need to extract the content inside the braces
              chunk.overwrite(0, startOffset + 1, preface)
              chunk.overwrite(endOffset - 1, code.length, suffix)
            } else {
              // For expression bodies, wrap in return statement
              chunk.overwrite(0, startOffset, preface)
              chunk.overwrite(endOffset, code.length, suffix)
            }

            asyncDatas[key] = {
              code: chunk.toString(),
              map: options.sourcemap ? chunk.generateMap({ hires: true }) : undefined,
            }

            // Replace the original function with a dynamic import
            const importCall = `() => import('${key}').then(r => (r.default || r)(${parameters}))`
            s.overwrite(codeIndex + fetcherFunction.start, codeIndex + fetcherFunction.end, importCall)
          },
        })

        if (s?.hasChanged()) {
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
