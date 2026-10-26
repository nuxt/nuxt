import { addTemplate } from '@nuxt/kit'
import { defu } from 'defu'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

import { createNormalizedRouteRulesRouter, genNormalizePathCode, normalizeRouteRulePath, parseRouteRulesRoute, resolveRouteRulesRoutes } from '../../nuxt/src/core/utils/route-rules.ts'

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
 * handler in front of it read the same rules the build compiled. A lookup takes the request
 * method, `GET` by default.
 */
export function addRouteRulesTemplate (): string {
  const { dst } = addTemplate({
    filename: 'vite-server/route-rules.mjs',
    write: true,
    getContents: ({ nuxt }) => {
      const fold = !nuxt.options.router.options.sensitive
      const { routes, baseURL } = resolveRouteRulesRoutes(nuxt)
      const methods = new Set(routes.map(route => parseRouteRulesRoute(route).method).filter(Boolean))
      if (methods.has('GET')) {
        methods.add('HEAD')
      }
      const matchers = ['', ...methods].map((method) => {
        const matcher = createNormalizedRouteRulesRouter(routes, baseURL, fold, undefined, method).compileToString({
          matchAll: true,
          serialize: rules => `{${Object.entries(rules)
            .filter(([name, value]) => value !== undefined && SUPPORTED_RULES.has(name))
            .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
            .join(',')}}`,
        })
        return `[${JSON.stringify(method)}, ${matcher}]`
      })
      return [
        `import { defu } from ${JSON.stringify(defuPath)}`,
        `const matchers = new Map([${matchers.join(',\n')}])`,
        genNormalizePathCode(fold),
        `export default (path, method = 'GET') => {`,
        `  const matcher = matchers.get(method.toUpperCase()) || matchers.get('')`,
        `  return defu({}, ...matcher('', normalizePath(path)).map(r => r.data).reverse())`,
        `}`,
      ].join('\n')
    },
  })
  return dst
}
