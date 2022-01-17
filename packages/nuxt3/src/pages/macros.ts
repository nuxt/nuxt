import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL, withQuery } from 'ufo'
import { findStaticImports, findExports } from 'mlly'

export interface TransformMacroPluginOptions {
  macros: Record<string, string>
}

export const TransformMacroPlugin = createUnplugin((options: TransformMacroPluginOptions) => {
  return {
    name: 'nuxt-pages-macros-transform',
    enforce: 'post',
    transformInclude (id) {
      // We only process SFC files for macros
      return parseURL(id).pathname.endsWith('.vue')
    },
    transform (code, id) {
      const { search } = parseURL(id)

      // Tree-shake out any runtime references to the macro.
      // We do this first as it applies to all files, not just those with the query
      for (const macro in options.macros) {
        const match = code.match(new RegExp(`\\b${macro}\\s*\\(\\s*`))?.[0]
        if (match) {
          code = code.replace(match, `/*#__PURE__*/ false && ${match}`)
        }
      }

      if (!parseQuery(search).macro) { return code }

      // [webpack] Re-export any imports from script blocks in the components
      // with workaround for vue-loader bug: https://github.com/vuejs/vue-loader/pull/1911
      const scriptImport = findStaticImports(code).find(i => parseQuery(i.specifier.replace('?macro=true', '')).type === 'script')
      if (scriptImport) {
        const specifier = withQuery(scriptImport.specifier.replace('?macro=true', ''), { macro: 'true' })
        return `export { meta } from "${specifier}"`
      }

      const currentExports = findExports(code)
      for (const match of currentExports) {
        if (match.type !== 'default') { continue }
        if (match.specifier && match._type === 'named') {
          // [webpack] Export named exports rather than the default (component)
          return code.replace(match.code, `export {${Object.values(options.macros).join(', ')}} from "${match.specifier}"`)
        } else {
          // ensure we tree-shake any _other_ default exports out of the macro script
          code = code.replace(match.code, '/*#__PURE__*/ false &&')
          code += '\nexport default {}'
        }
      }

      for (const macro in options.macros) {
        // Skip already-processed macros
        if (currentExports.some(e => e.name === options.macros[macro])) { continue }

        const { 0: match, index = 0 } = code.match(new RegExp(`\\b${macro}\\s*\\(\\s*`)) || {} as RegExpMatchArray
        const macroContent = match ? extractObject(code.slice(index + match.length)) : 'undefined'

        code += `\nexport const ${options.macros[macro]} = ${macroContent}`
      }

      return code
    }
  }
})

const starts = {
  '{': '}',
  '[': ']',
  '(': ')',
  '<': '>',
  '"': '"',
  "'": "'"
}

function extractObject (code: string) {
  // Strip comments
  code = code.replace(/^\s*\/\/.*$/gm, '')

  const stack = []
  let result = ''
  do {
    if (stack[0] === code[0] && result.slice(-1) !== '\\') {
      stack.shift()
    } else if (code[0] in starts) {
      stack.unshift(starts[code[0]])
    }
    result += code[0]
    code = code.slice(1)
  } while (stack.length && code.length)
  return result
}
