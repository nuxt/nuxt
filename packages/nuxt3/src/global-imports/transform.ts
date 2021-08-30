import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { IdentifierMap } from './types'

const excludeRE = [
  // imported from other module
  /\bimport\s*([\w_$]*?),?\s*\{([\s\S]*?)\}\s*from\b/g,
  // defined as function
  /\bfunction\s*([\s\S]+?)\s*\(/g,
  // defined as local variable
  /\b(?:const|let|var)\s*([\w\d_$]+?)\b/g
]

const multilineCommentsRE = /\/\*(.|[\r\n])*?\*\//gm
const singlelineCommentsRE = /\/\/.*/g

function stripeComments (code: string) {
  return code
    .replace(multilineCommentsRE, '')
    .replace(singlelineCommentsRE, '')
}

export const TransformPlugin = createUnplugin((map: IdentifierMap) => {
  const matchRE = new RegExp(`\\b(${Object.keys(map).join('|')})\\b`, 'g')

  return {
    name: 'nuxt-global-imports-transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(id)
      const query = parseQuery(search)

      if (id.includes('node_modules')) {
        return false
      }

      // vue files
      if (pathname.endsWith('.vue') && (query.type === 'template' || !search)) {
        return true
      }

      // js files
      if (pathname.match(/\.((c|m)?j|t)sx?/g)) {
        return true
      }
    },
    transform (code) {
      // strip comments so we don't match on them
      const withoutComment = stripeComments(code)

      // find all possible injection
      const matched = new Set(Array.from(withoutComment.matchAll(matchRE)).map(i => i[1]))

      // remove those already defined
      for (const regex of excludeRE) {
        Array.from(withoutComment.matchAll(regex))
          .flatMap(i => [...(i[1]?.split(',') || []), ...(i[2]?.split(',') || [])])
          .forEach(i => matched.delete(i.trim()))
      }

      if (!matched.size) {
        return null
      }

      const modules: Record<string, string[]> = {}

      // group by module name
      Array.from(matched).forEach((name) => {
        const moduleName = map[name]!
        if (!modules[moduleName]) {
          modules[moduleName] = []
        }
        modules[moduleName].push(name)
      })

      // stringify import
      const imports = Object.entries(modules)
        .map(([moduleName, names]) => `import { ${names.join(',')} } from '${moduleName}';`)
        .join('')

      return imports + code
    }
  }
})
