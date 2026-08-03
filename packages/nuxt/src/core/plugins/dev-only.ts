import { generateTransform, rolldownString } from 'rolldown-string'
import { createUnplugin } from 'unplugin'
import { parse } from 'ultrahtml'
import type { Node } from 'ultrahtml'
import { isVue } from '../utils/index.ts'

const DEVONLY_COMP_SINGLE_RE = /<(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?>[\s\S]*?<\/(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)>/
const DEVONLY_COMP_RE = /<(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?>[\s\S]*?<\/(?:dev-only|DevOnly|lazy-dev-only|LazyDevOnly)>/g

export const DevOnlyPlugin = () => createUnplugin(() => {
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
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        for (const match of code.matchAll(DEVONLY_COMP_RE)) {
          const ast: Node = parse(match[0]).children[0]
          const fallback: Node | undefined = ast.children?.find((n: Node) => {
            if (n.name !== 'template') { return false }
            return 'fallback' in n.attributes || '#fallback' in n.attributes || 'v-slot:fallback' in n.attributes
          })
          const replacement = fallback ? match[0].slice(fallback.loc[0].end, fallback.loc.at(-1).start) : ''
          s.overwrite(match.index!, match.index! + match[0].length, replacement)
        }

        return generateTransform(s, id)
      },
    },
  }
})
