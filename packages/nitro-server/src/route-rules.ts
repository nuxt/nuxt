import { pathToFileURL } from 'node:url'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { resolveModulePath } from 'exsolve'
import type { Nitro, NitroConfig } from 'nitro/types'

/**
 * Rewrites `redirect.statusCode` to `redirect.status`, warning once per route.
 *
 * The nitro v2 spelling is silently ignored by the version Nuxt now builds on, which would turn
 * a configured redirect status into a default without any indication.
 */
export function normalizeLegacyRouteRules (routeRules: NitroConfig['routeRules']): void {
  for (const route in routeRules) {
    const redirect = routeRules[route]?.redirect
    if (!redirect || typeof redirect !== 'object' || !('statusCode' in redirect)) { continue }

    const { statusCode, ...rest } = redirect as { statusCode?: number, status?: number, to: string }
    routeRules[route]!.redirect = { ...rest, status: rest.status ?? statusCode }
    bundlerDiagnostics.NUXT_B7026({ route })
  }
}

/**
 * Lower-case a request path for case-insensitive route rule matching. Percent-encoded
 * characters are folded too, so `/%C3%89cole` folds to `/%C3%A9cole`.
 *
 * Inlined by source into the server bundle, so it must not reference anything outside itself.
 */
export function foldRouteRulePath (path: string): string {
  return path.replace(/(?:%[\da-f]{2})+|[^%]+/gi, (run) => {
    if (run[0] !== '%') { return run.toLowerCase() }
    try {
      const decoded = decodeURIComponent(run)
      const folded = decoded.toLowerCase()
      return folded === decoded ? run : encodeURIComponent(folded)
    } catch {
      return run
    }
  })
}

/**
 * Lower-case a route rule pattern as {@link foldRouteRulePath} does a request path, keeping
 * param names and backslash escapes (such as `\D` in a constraint) as written.
 */
export function foldRouteRulePattern (pattern: string): string {
  let depth = 0
  return pattern.replace(/\\.|:\w+|[^\\:()]+|[:()]/g, (token) => {
    if (token === '(') {
      depth++
    } else if (token === ')') {
      depth = Math.max(0, depth - 1)
    }
    return token[0] === '\\' || (token[0] === ':' && depth === 0) ? token : foldRouteRulePath(token)
  })
}

/**
 * Re-key route rules by their folded pattern. Rules whose keys fold together are merged, with
 * object options merged one level deep and later keys taking precedence.
 */
function foldRouteRules (routeRules: NitroConfig['routeRules']): NonNullable<NitroConfig['routeRules']> {
  const folded: Record<string, Record<string, unknown>> = {}
  for (const key in routeRules) {
    const foldedKey = foldRouteRulePattern(key)
    const rules = folded[foldedKey] ||= {}
    for (const [name, options] of Object.entries(routeRules[key] || {})) {
      const existing = rules[name]
      rules[name] = isObject(existing) && isObject(options) ? { ...existing, ...options } : options
    }
  }
  return folded as NonNullable<NitroConfig['routeRules']>
}

function isObject (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

const ROUTING_ID = '#nitro/virtual/routing'
const FIND_ROUTE_RULES_EXPORT = 'export const findRouteRules = '

/**
 * Rewrite nitro's route rule lookup so that a request also matches rules whose pattern differs
 * from its path only in casing. Rules are resolved from nitro's own table unless a table of
 * folded patterns matches more of them.
 */
export function routeRulesCaseFoldPlugin (getNitro: () => Nitro) {
  return {
    name: 'nuxt:route-rules-case-fold',
    transform: {
      filter: { id: /^#nitro\/virtual\/routing$/ },
      async handler (code: string, id: string) {
        if (id !== ROUTING_ID) { return }
        if (!code.includes(FIND_ROUTE_RULES_EXPORT)) {
          throw new Error(`[nuxt] Could not find \`findRouteRules\` in \`${ROUTING_ID}\` to match route rules case-insensitively.`)
        }

        const nitro = getNitro()
        const { compileFindRouteRules, compileHandlersImport } = await importRouteRulesCompiler()
        const rules = foldRouteRules(nitro.options.routeRules)
        const options = {
          runtimeRules: { cache: '#nitro/runtime/route-rule-handlers' },
          baseURL: foldRouteRulePattern(nitro.options.baseURL || ''),
          handlersImportName: '__foldedRuleHandlers__',
          preMerge: true,
        }

        return [
          code.replace(FIND_ROUTE_RULES_EXPORT, 'const findSensitiveRouteRules = '),
          compileHandlersImport(rules, options),
          `const findFoldedRouteRules = ${compileFindRouteRules(rules, options)}`,
          `const foldRouteRulePath = ${foldRouteRulePath.toString()}`,
          `export const findRouteRules = (method, path) => {`,
          `  const sensitive = findSensitiveRouteRules(method, path)`,
          `  const folded = findFoldedRouteRules(method, foldRouteRulePath(path))`,
          `  return folded.length > sensitive.length ? folded : sensitive`,
          `}`,
        ].join('\n')
      },
    },
  }
}

/** The route rules compiler of the h3 that nitro bundles. */
function importRouteRulesCompiler (): Promise<typeof import('h3/rules/compiler')> {
  const from = resolveModulePath('nitro/package.json', { from: import.meta.url })
  return import(pathToFileURL(resolveModulePath('h3/rules/compiler', { from })).href)
}
