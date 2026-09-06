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
    'useRuntimeConfig',
  ],
}

/**
 * h3's remaining helpers, for code that reaches past the portable surface. Names
 * `nuxt/server` provides are dropped, so which module a name resolves to does not depend
 * on the order the presets are applied in.
 */
export async function getH3ImportsPreset () {
  const h3Exports = await resolveModuleExportNames('nitro/h3', {
    url: import.meta.url,
  })
  const portable = new Set(nuxtServerImportsPreset.imports)
  return {
    from: 'nitro/h3',
    imports: h3Exports.filter(n => !/^[A-Z]/.test(n) && n !== 'use' && !portable.has(n)),
  }
}
