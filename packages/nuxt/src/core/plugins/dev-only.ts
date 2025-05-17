import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { type Node, parse } from 'ultrahtml'
import { isVue } from '../utils'

interface DevOnlyPluginOptions {
  sourcemap?: boolean
}

const DEVONLY_COMP_SINGLE_RE = /<(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)>[\s\S]*?<\/(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)>/
const DEVONLY_COMP_RE = /<(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)>[\s\S]*?<\/(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)>/g

export const DevOnlyPlugin = (options: DevOnlyPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:server-devonly:transform',
    enforce: 'pre',
    transformInclude (id) {
      return isVue(id, { type: ['template'] })
    },
    transform: {
      filter: {
        code: { include: DEVONLY_COMP_SINGLE_RE },
      },
      handler (code) {
        const s = new MagicString(code)
        for (const match of code.matchAll(DEVONLY_COMP_RE)) {
          const ast: Node = parse(match[0]).children[0]
          const fallback: Node | undefined = ast.children?.find((n: Node) => {
            if (n.name !== 'template') { return false }
            return 'fallback' in n.attributes || '#fallback' in n.attributes
          })
          const replacement = fallback ? match[0].slice(fallback.loc[0].end, fallback.loc[fallback.loc.length - 1].start) : ''
          s.overwrite(match.index!, match.index! + match[0].length, replacement)
        }

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
