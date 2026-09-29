import { resolveModuleExportNames } from '@nuxt/kit/internal'

// TODO: defineRenderHandler and useEvent
export const v2ImportsPreset = [
  // `getRouteRules` and `useRuntimeConfig` are auto-imported from `nuxt/server`
  {
    from: 'nitro/app',
    imports: ['useNitroApp'],
  },
  {
    from: 'nitro',
    imports: [
      'defineRouteMeta',
      {
        name: 'defineErrorHandler',
        as: 'defineNitroErrorHandler',
      },
      {
        name: 'definePlugin',
        as: 'defineNitroPlugin',
      },
      {
        name: 'definePlugin',
        as: 'nitroPlugin',
      },
    ],
  },
  {
    from: 'nitro/cache',
    imports: [
      'defineCachedFunction',
      { name: 'defineCachedFunction', as: 'cachedFunction' },
      'defineCachedHandler',
      { name: 'defineCachedHandler', as: 'defineCachedEventHandler' },
      { name: 'defineCachedHandler', as: 'cachedEventHandler' },
    ],
  },
  {
    from: 'nitro/storage',
    imports: ['useStorage'],
  },
  {
    from: 'nitro/task',
    imports: ['defineTask', 'runTask'],
  },
]

/**
 * The portable server surface, auto-imported in preference to h3's equivalents, so that
 * code written without an import statement is code that survives an h3 or Nitro major.
 *
 * An explicit list rather than one resolved from the module, because which names are
 * auto-imported is a compatibility promise and should change deliberately.
 */
export const nuxtServerImportsPreset = {
  from: 'nuxt/server',
  imports: [
    'createError',
    'defineEventHandler',
    'deleteCookie',
    'getCookie',
    'getQuery',
    'getRequestHeader',
    'getRequestHeaders',
    'getRequestURL',
    'getRouteRules',
    'isNuxtError',
    'readBody',
    'sendRedirect',
    'setCookie',
    'setResponseHeader',
    'setResponseHeaders',
    'setResponseStatus',
    'toNuxtRequestEvent',
    'useRuntimeConfig',
  ],
}

/**
 * The portable surface with individual names redirected to another module, for code
 * that is given Nitro v2 semantics for some of them (the `nitroLegacy` toggles, and
 * module code written for Nitro v2).
 *
 * @param overrides Name to module, for the names that should not come from `nuxt/server`.
 */
export function getNuxtServerImportsPreset (overrides: Record<string, string> = {}): Array<{ from: string, imports: string[] }> {
  const grouped = new Map<string, string[]>()
  for (const name of nuxtServerImportsPreset.imports) {
    const from = overrides[name] ?? nuxtServerImportsPreset.from
    const names = grouped.get(from)
    if (names) {
      names.push(name)
    } else {
      grouped.set(from, [name])
    }
  }
  return [...grouped].map(([from, imports]) => ({ from, imports }))
}

let h3ExportNames: Promise<string[]> | undefined

/** The lowercase helper names `nitro/h3` exports, resolved once per process. */
export function getH3ExportNames (): Promise<string[]> {
  return h3ExportNames ||= resolveModuleExportNames('nitro/h3', { url: import.meta.url })
    .then(names => names.filter(n => !/^[A-Z]/.test(n) && n !== 'use'))
}

/** v1-only h3 helpers, which are provided by the compat shim rather than `nitro/h3`. */
const h3V1Imports = ['send', 'sendError', 'splitCookiesString', 'isStream', 'isWebResponse', 'defineRequestMiddleware', 'defineResponseMiddleware']

/**
 * h3's remaining helpers, for code that reaches past the portable surface. Names
 * `nuxt/server` provides are dropped, so which module a name resolves to does not depend
 * on the order the presets are applied in.
 *
 * @param from Module to import the helpers from, for cases where `h3` resolves
 * to the h3 v1 compat shim rather than `nitro/h3`; the shim also carries the v1-only names.
 */
export async function getH3ImportsPreset (from?: string): Promise<{ from: string, imports: string[] }> {
  const portable = new Set(nuxtServerImportsPreset.imports)
  const imports = (await getH3ExportNames()).filter(n => !portable.has(n))
  return {
    from: from ?? 'nitro/h3',
    imports: from ? [...imports, ...h3V1Imports] : imports,
  }
}
