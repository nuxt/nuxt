import { runInNewContext } from 'node:vm'
import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import type { Node } from 'estree-walker'
import type { CallExpression } from 'estree'
import { walk } from 'estree-walker'
import { normalize } from 'pathe'
import { parseURL } from 'ufo'

const ROUTE_RULE_RE = /\bdefineRouteRules\(/

interface RouteRuleExtractorPluginOptions {
  routeRules: Record<string, any>
  pageMap: Record<string, string>
}

export const routeRuleExtractorPlugin = createUnplugin((options: RouteRuleExtractorPluginOptions) => {
  return {
    name: 'test',
    transformInclude (id) {
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(normalize(id)).href))
      return pathname in options.pageMap
    },
    transform (code, id) {
      if (!ROUTE_RULE_RE.test(code)) { return null }
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(normalize(id)).href))

      walk(this.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }) as Node, {
        enter (_node) {
          if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
          const node = _node as CallExpression & { start: number, end: number }
          const name = 'name' in node.callee && node.callee.name
          if (name === 'defineRouteRules') {
            const rulesString = code.slice(node.start, node.end)
            try {
              options.routeRules[options.pageMap[pathname]] = JSON.parse(runInNewContext(rulesString.replace('defineRouteRules', 'JSON.stringify'), {}))
            } catch {
              console.error(`[nuxt] Error parsing route rules in \`${pathname}\`. They should be JSON-serializable.`)
            }
          }
        }
      })

      return null
    }
  }
})
