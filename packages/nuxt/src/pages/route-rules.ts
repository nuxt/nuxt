import { runInNewContext } from 'node:vm'
import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitropack/types'
import { normalize } from 'pathe'

import { parseAndWalk } from 'oxc-walker'
import { getLoader } from '../core/utils'
import { extractScriptContent, pathToNitroGlob } from './utils'

const ROUTE_RULE_RE = /\bdefineRouteRules\(/
const pageCodeCache: Record<string, string> = {}
const ruleCache: Record<string, NitroRouteConfig | null> = {}

export function extractRouteRules (code: string, path: string): NitroRouteConfig | null {
  if (!ROUTE_RULE_RE.test(code)) { return null }

  // set/update pageCodeCache, invalidate ruleCache on cache mismatch
  if (!(path in pageCodeCache) || pageCodeCache[path] !== code) {
    pageCodeCache[path] = code
    delete ruleCache[path]
  }

  if (path in ruleCache) {
    return ruleCache[path] || null
  }

  const loader = getLoader(path)
  if (!loader) { return null }

  let rule: NitroRouteConfig | null = null
  const contents = loader === 'vue' ? extractScriptContent(code) : [{ code, loader }]
  for (const script of contents) {
    if (rule) { break }

    code = script?.code || code

    parseAndWalk(code, 'file.' + (script?.loader || 'ts'), (node) => {
      if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') { return }
      if (node.callee.name === 'defineRouteRules') {
        const rulesString = code.slice(node.start, node.end)
        try {
          rule = JSON.parse(runInNewContext(rulesString.replace('defineRouteRules', 'JSON.stringify'), {}))
        } catch {
          throw new Error('[nuxt] Error parsing route rules. They should be JSON-serializable.')
        }
      }
    })
  }

  ruleCache[path] = rule
  return rule
}

export function getMappedPages (pages: NuxtPage[], paths = {} as { [absolutePath: string]: string | null }, prefix = '') {
  for (const page of pages) {
    if (page.file) {
      const filename = normalize(page.file)
      paths[filename] = pathToNitroGlob(prefix + page.path)
    }
    if (page.children?.length) {
      getMappedPages(page.children, paths, page.path + '/')
    }
  }
  return paths
}

export function globRouteRulesFromPages (pages: NuxtPage[], paths = {} as { [glob: string]: NitroRouteConfig }, prefix = '') {
  for (const page of pages) {
    if (page.meta?.routeRules) {
      const glob = pathToNitroGlob(prefix + page.path)
      if (glob) {
        paths[glob] = page.meta.routeRules
      }
    }
    if (page.children?.length) {
      globRouteRulesFromPages(page.children, paths, page.path + '/')
    }
  }
  return paths
}

export function removePagesMetaRouteRules (routes: NuxtPage[]) {
  for (const route of routes) {
    delete route.meta?.routeRules
    if (route.children?.length) {
      removePagesMetaRouteRules(route.children)
    }
  }
}
