import { pathToFileURL } from 'node:url'
import { stripLiteral } from 'strip-literal'
import { parseQuery, parseURL } from 'ufo'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'

interface DevOnlyPluginOptions {
  sourcemap?: boolean
}

export const DevOnlyPlugin = createUnplugin((options: DevOnlyPluginOptions) => {
  const DEVONLY_COMP_RE = /<(?:dev-only|DevOnly)>[\s\S]*?<\/(?:dev-only|DevOnly)>/g
  const FALLBACK_SLOT_RE = /<template\s+#fallback>(?<fallback>[\s\S]*?)<\/template>/

  return {
    name: 'nuxt:server-devonly:transform',
    enforce: 'pre',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const { type } = parseQuery(search)

      // vue files
      if (pathname.endsWith('.vue') && (type === 'template' || !search)) {
        return true
      }
    },
    transform (code) {
      if (!code.match(DEVONLY_COMP_RE)) { return }

      const s = new MagicString(code)
      const strippedCode = stripLiteral(code)
      for (const match of strippedCode.matchAll(DEVONLY_COMP_RE) || []) {
        const replacement = match[0].match(FALLBACK_SLOT_RE)?.groups?.fallback || ''
        s.overwrite(match.index!, match.index! + match[0].length, replacement)
      }

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
