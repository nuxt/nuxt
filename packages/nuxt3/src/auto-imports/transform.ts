import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { toImports } from './utils'
import { AutoImportContext } from './context'

const excludeRE = [
  // imported from other module
  /\bimport\s*([\s\S]+?)\s*from\b/g,
  // defined as function
  /\bfunction\s*([\w_$]+?)\s*\(/g,
  // defined as local variable
  /\b(?:const|let|var)\s+?(\[[\s\S]*?\]|\{[\s\S]*?\}|[\s\S]+?)\s*?[=;\n]/g
]

const importAsRE = /^.*\sas\s+/
const seperatorRE = /[,[\]{}\n]/g
const multilineCommentsRE = /\/\*\s(.|[\r\n])*?\*\//gm
const singlelineCommentsRE = /\/\/\s.*/g
const templateLiteralRE = /\$\{(.*)\}/g
const quotesRE = [
  /(["'])((?:\\\1|(?!\1)|.|\r)*?)\1/gm,
  /([`])((?:\\\1|(?!\1)|.|\n|\r)*?)\1/gm
]

function stripeCommentsAndStrings (code: string) {
  return code
    .replace(multilineCommentsRE, '')
    .replace(singlelineCommentsRE, '')
    .replace(templateLiteralRE, '` + $1 + `')
    .replace(quotesRE[0], '""')
    .replace(quotesRE[1], '``')
}

export const TransformPlugin = createUnplugin((ctx: AutoImportContext) => {
  return {
    name: 'nuxt-auto-imports-transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(id)
      const { type, macro } = parseQuery(search)

      // Exclude node_modules by default
      if (ctx.transform.exclude.some(pattern => id.match(pattern))) {
        return false
      }

      // vue files
      if (
        pathname.endsWith('.vue') &&
        (type === 'template' || type === 'script' || macro || !search)
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
      const striped = stripeCommentsAndStrings(code)

      // find all possible injection
      const matched = new Set(Array.from(striped.matchAll(ctx.matchRE)).map(i => i[1]))

      // remove those already defined
      for (const regex of excludeRE) {
        Array.from(striped.matchAll(regex))
          .flatMap(i => [
            ...(i[1]?.split(seperatorRE) || []),
            ...(i[2]?.split(seperatorRE) || [])
          ])
          .map(i => i.replace(importAsRE, '').trim())
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
