import { addTemplate, logger } from '@nuxt/kit'
import { defu } from 'defu'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

import { createNormalizedRouteRulesRouter, genNormalizePathCode, matchAllRouteRules, normalizeRouteRuleLookupPath, parseRouteRulesRoute, resolveRouteRulesRoutes } from '@nuxt/kit/internal'

/**
 * Rules an HTTP layer handles, which this builder reports as unsupported. The matcher leaves
 * them out: the renderer reads `cache` when no page matches the request.
 */
export const SERVER_ONLY_RULES = new Set(['cache', 'swr', 'isr', 'proxy', 'cors'])

const defuPath = resolveModulePath('defu', { try: true, from: import.meta.url }) ?? 'defu'

const warnedRules = new WeakMap<Nuxt, Set<string>>()

/**
 * Build-time matcher over the resolved route rules, looked up by a path without the base URL:
 * the routes the build reasons about (page routes, prerender seeds) are written that way.
 */
export function createRouteRulesMatcher (nuxt: Nuxt): (path: string) => Record<string, any> {
  const fold = !nuxt.options.router.options.sensitive
  const router = createNormalizedRouteRulesRouter(resolveRouteRulesRoutes(nuxt).routes, '', fold)
  return path => defu({}, ...matchAllRouteRules(path => router.matchAll('', normalizeRouteRuleLookupPath(path, fold)), path).reverse()) as Record<string, any>
}

/**
 * Emit the matcher the server bundle resolves rules through, so that a render and the
 * handler in front of it read the same rules the build compiled. A lookup takes the request
 * method, `GET` by default.
 *
 * Every JSON-serialisable rule is emitted, not only the ones this builder acts on: a module
 * declares its own keys through `RouteRuleConfigExtensions`, and a renderer plugin reads them
 * back through `getRouteRules()`.
 */
export function addRouteRulesTemplate (): string {
  const { dst } = addTemplate({
    filename: 'vite-server/route-rules.mjs',
    write: true,
    getContents: ({ nuxt }) => {
      const fold = !nuxt.options.router.options.sensitive
      const { routes, baseURL } = resolveRouteRulesRoutes(nuxt)
      const basePrefix = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
      const methods = new Set(routes.map(route => parseRouteRulesRoute(route).method).filter(Boolean))
      if (methods.has('GET')) {
        methods.add('HEAD')
      }
      const matchers = ['', ...methods].map((method) => {
        const matcher = createNormalizedRouteRulesRouter(routes, baseURL, fold, undefined, method).compileToString({
          matchAll: true,
          serialize: rules => `{${Object.entries(rules)
            .flatMap(([name, value]) => {
              if (name === '__proto__' || SERVER_ONLY_RULES.has(name)) { return [] }
              const json = serializeRule(nuxt, name, name === 'redirect' ? withRedirectBase(value, basePrefix) : value)
              return json === undefined ? [] : [`${JSON.stringify(name)}: ${json}`]
            })
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
        `  return defu({}, ...matchAllRouteRules(path => matcher('', normalizePath(path)).map(r => r.data), path).reverse())`,
        `}`,
      ].join('\n')
    },
  })
  return dst
}

/**
 * Whether a rule value can be written into the compiled matcher as an object literal. A
 * function, a class instance, a non-finite number, or a container that holds itself cannot,
 * since JSON has no representation for it. `undefined` is tolerated: `JSON.stringify` writes
 * it as a missing property, or as `null` in an array.
 *
 * `ancestors` holds the containers on the path down to `value`, so a container met twice while
 * descending is a cycle rather than a value to walk again, while a value referenced twice side
 * by side is accepted.
 */
function isSerializable (value: unknown, ancestors: Set<unknown> = new Set()): boolean {
  if (value === undefined || value === null || typeof value === 'string' || typeof value === 'boolean') { return true }
  if (typeof value === 'number') { return Number.isFinite(value) }
  if (typeof value !== 'object') { return false }
  if (ancestors.has(value)) { return false }
  const proto = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) { return false }

  ancestors.add(value)
  const serializable = Array.isArray(value)
    ? value.every(item => isSerializable(item, ancestors))
    : Object.entries(value).every(([key, item]) => key !== '__proto__' && isSerializable(item, ancestors))
  ancestors.delete(value)
  return serializable
}

function serializeRule (nuxt: Nuxt, name: string, value: unknown): string | undefined {
  if (value === undefined) { return undefined }

  if (isSerializable(value)) {
    try {
      return JSON.stringify(value)
    } catch {
      // a getter or a `toJSON` that throws leaves nothing to write
    }
  }

  const warned = warnedRules.get(nuxt) ?? warnedRules.set(nuxt, new Set()).get(nuxt)!
  if (!warned.has(name)) {
    warned.add(name)
    logger.warn(`[nuxt:vite-server] Route rule \`${name}\` is not JSON-serialisable, so it is left out of the rules a request is matched against.`)
  }
  return undefined
}

function withRedirectBase (redirect: unknown, prefix: string): unknown {
  if (!prefix || !redirect || typeof redirect !== 'object' || typeof (redirect as { base?: unknown }).base !== 'string') { return redirect }
  return { ...redirect, base: prefix + (redirect as { base: string }).base }
}
