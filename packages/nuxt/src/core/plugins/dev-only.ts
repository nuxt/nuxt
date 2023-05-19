import { pathToFileURL } from 'node:url'
import { stripLiteral } from 'strip-literal'
import { parseQuery, parseURL } from 'ufo'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { type Node, parse } from 'ultrahtml'

interface DevOnlyPluginOptions {
  sourcemap?: boolean
}

export const DevOnlyPlugin = createUnplugin((options: DevOnlyPluginOptions) => {
  const DEVONLY_COMP_RE = /<(?:dev-only|DevOnly)>[\s\S]*?<\/(?:dev-only|DevOnly)>/g

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
        const ast: Node = parse(match[0]).children[0]
        const fallback: Node | undefined = ast.children?.find((n: Node) => n.name === 'template' && Object.values(n.attributes).includes('#fallback'))
        const replacement = fallback ? match[0].slice(fallback.loc[0].end, fallback.loc[fallback.loc.length - 1].start) : ''

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
