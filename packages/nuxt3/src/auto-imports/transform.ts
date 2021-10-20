import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { toImports } from './utils'
import { AutoImportContext } from './context'

const excludeRE = [
  // imported from other module
  /\bimport\s*([\w_$]*?),?\s*(?:\{([\s\S]*?)\})?\s*from\b/g,
  // defined as function
  /\bfunction\s*([\w_$]+?)\s*\(/g,
  // defined as local variable
  /\b(?:const|let|var)\s+?(\[[\s\S]*?\]|\{[\s\S]*?\}|[\s\S]+?)\s*?[=;\n]/g
]

const importAsRE = /^.*\sas\s+/
const seperatorRE = /[,[\]{}\n]/g
const multilineCommentsRE = /\/\*(.|[\r\n])*?\*\//gm
const singlelineCommentsRE = /^\s*\/\/.*$/gm

function stripeComments (code: string) {
  return code
    .replace(multilineCommentsRE, '')
    .replace(singlelineCommentsRE, '')
}

export const TransformPlugin = createUnplugin((ctx: AutoImportContext) => {
  return {
    name: 'nuxt-auto-imports-transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(id)
      const { type } = parseQuery(search)

      if (id.includes('node_modules')) {
        return false
      }

      // vue files
      if (
        pathname.endsWith('.vue') &&
        (type === 'template' || type === 'script' || !search)
      ) {
        return true
      }

      // js files
      if (pathname.match(/\.((c|m)?j|t)sx?$/g)) {
        return true
      }
    },
    transform (code) {
      // strip comments so we don't match on them
      const withoutComment = stripeComments(code)

      // find all possible injection
      const matched = new Set(Array.from(withoutComment.matchAll(ctx.matchRE)).map(i => i[1]))

      // remove those already defined
      for (const regex of excludeRE) {
        Array.from(withoutComment.matchAll(regex))
          .flatMap(i => [
            ...(i[1]?.split(seperatorRE) || []),
            ...(i[2]?.split(seperatorRE) || [])
          ])
          .map(i => i.replace(importAsRE, '').trim())
          .filter(Boolean)
          .forEach(i => matched.delete(i))
      }

      if (!matched.size) {
        return null
      }

      // For webpack4/bridge support
      const isCJSContext = code.includes('require(')

      const matchedImports = Array.from(matched).map(name => ctx.map.get(name)).filter(Boolean)
      const imports = toImports(matchedImports, isCJSContext)

      return imports + code
    }
  }
})
