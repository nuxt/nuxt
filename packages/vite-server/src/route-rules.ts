import { addTemplate } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

import { createNormalizedRouteRulesRouter, resolveRouteRules, resolveRouteRulesCode, resolveRouteRulesRoutes } from '../../nuxt/src/core/utils/route-rules.ts'
import type { RouteRulesRouter } from '../../nuxt/src/core/utils/route-rules.ts'

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
  return path => resolveRouteRules(router, path, fold)
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
      const compileOptions: Parameters<RouteRulesRouter['compileToString']>[0] = {
        matchAll: true,
        serialize: rules => `{${Object.entries(rules)
          .filter(([name, value]) => value !== undefined && SUPPORTED_RULES.has(name))
          .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
          .join(',')}}`,
      }
      const sensitiveMatcher = createNormalizedRouteRulesRouter(routes, baseURL, false).compileToString(compileOptions)
      const foldedMatcher = fold ? createNormalizedRouteRulesRouter(routes, baseURL, true).compileToString(compileOptions) : sensitiveMatcher
      return [
        `import { defu } from ${JSON.stringify(defuPath)}`,
        `const sensitiveMatcher = ${sensitiveMatcher}`,
        `const foldedMatcher = ${foldedMatcher === sensitiveMatcher ? 'sensitiveMatcher' : foldedMatcher}`,
        resolveRouteRulesCode,
        `export default path => resolveRouteRules(sensitiveMatcher, foldedMatcher, path, ${fold})`,
      ].join('\n')
    },
  })
  return dst
}
