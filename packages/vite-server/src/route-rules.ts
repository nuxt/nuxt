import { addTemplate } from '@nuxt/kit'
import { defu } from 'defu'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

import { createNormalizedRouteRulesRouter, normalizePathCode, normalizeRouteRulePath, resolveRouteRulesRoutes } from '../../nuxt/src/core/utils/route-rules.ts'

/**
 * The rules this builder resolves for itself: the renderer reads `ssr`, `streaming`,
 * `noScripts` and `prerender`, and the fetch handler answers `redirect` and sets `headers`.
 * Caching, proxying and CORS belong to an HTTP layer, which this builder does not provide.
 */
const SUPPORTED_RULES = new Set(['ssr', 'streaming', 'noScripts', 'prerender', 'redirect', 'headers'])

const defuPath = resolveModulePath('defu', { try: true, from: import.meta.url }) ?? 'defu'

/**
 * Build-time matcher over the resolved route rules, looked up by a path without the base URL:
 * the routes the build reasons about (page routes, prerender seeds) are written that way.
 */
export function createRouteRulesMatcher (nuxt: Nuxt): (path: string) => Record<string, any> {
  const fold = !nuxt.options.router.options.sensitive
  const router = createNormalizedRouteRulesRouter(resolveRouteRulesRoutes(nuxt).routes, '', fold)
  return path => defu({}, ...router.matchAll('', normalizeRouteRulePath(path, fold)).reverse()) as Record<string, any>
}

/**
 * Emit the matcher the server bundle resolves rules through, so that a render and the
 * handler in front of it read the same rules the build compiled.
 */
export function addRouteRulesTemplate (): string {
  const { dst } = addTemplate({
    filename: 'vite-server/route-rules.mjs',
    write: true,
    getContents: ({ nuxt }) => {
      const fold = !nuxt.options.router.options.sensitive
      const { routes, baseURL } = resolveRouteRulesRoutes(nuxt)
      const matcher = createNormalizedRouteRulesRouter(routes, baseURL, fold).compileToString({
        matchAll: true,
        serialize: rules => `{${Object.entries(rules)
          .filter(([name, value]) => value !== undefined && SUPPORTED_RULES.has(name))
          .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
          .join(',')}}`,
      })
      return [
        `import { defu } from ${JSON.stringify(defuPath)}`,
        `const matcher = ${matcher}`,
        normalizePathCode,
        `export default path => defu({}, ...matcher('', normalizePath(path, ${fold})).map(r => r.data).reverse())`,
      ].join('\n')
    },
  })
  return dst
}
