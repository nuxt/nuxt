import { runInNewContext } from 'node:vm'
import type { Node } from 'estree-walker'
import type { CallExpression } from 'estree'
import { walk } from 'estree-walker'
import { transform } from 'esbuild'
import { parse } from 'acorn'
import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitropack'
import { normalize } from 'pathe'
import { extractScriptContent, pathToNitroGlob } from './utils'

const ROUTE_RULE_RE = /\bdefineRouteRules\(/
const ruleCache: Record<string, NitroRouteConfig | null> = {}

export async function extractRouteRules (code: string): Promise<NitroRouteConfig | null> {
  if (code in ruleCache) {
    return ruleCache[code]
  }
  if (!ROUTE_RULE_RE.test(code)) { return null }

  code = extractScriptContent(code) || code

  let rule: NitroRouteConfig | null = null

  const js = await transform(code, { loader: 'ts' })
  walk(parse(js.code, {
    sourceType: 'module',
    ecmaVersion: 'latest'
  }) as Node, {
    enter (_node) {
      if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
      const node = _node as CallExpression & { start: number, end: number }
      const name = 'name' in node.callee && node.callee.name
      if (name === 'defineRouteRules') {
        const rulesString = js.code.slice(node.start, node.end)
        try {
          rule = JSON.parse(runInNewContext(rulesString.replace('defineRouteRules', 'JSON.stringify'), {}))
        } catch {
          throw new Error('[nuxt] Error parsing route rules. They should be JSON-serializable.')
        }
      }
    }
  })

  ruleCache[code] = rule
  return rule
}

export function getMappedPages (pages: NuxtPage[], paths = {} as { [absolutePath: string]: string | null }, prefix = '') {
  for (const page of pages) {
    if (page.file) {
      const filename = normalize(page.file)
      paths[filename] = pathToNitroGlob(prefix + page.path)
    }
    if (page.children) {
      getMappedPages(page.children, paths, page.path + '/')
    }
  }
  return paths
}
