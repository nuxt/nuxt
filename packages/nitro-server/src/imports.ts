import { resolveModuleExportNames } from 'mlly'

// TODO: defineRenderHandler and useEvent
export const v2ImportsPreset = [
  {
    from: 'nitro/app',
    imports: ['useNitroApp', 'getRouteRules'],
  },
  {
    from: 'nitro/runtime-config',
    imports: ['useRuntimeConfig'],
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

export async function getH3ImportsPreset () {
  const h3Exports = await resolveModuleExportNames('nitro/h3', {
    url: import.meta.url,
  })
  return {
    from: 'h3',
    imports: h3Exports.filter(n => !/^[A-Z]/.test(n) && n !== 'use'),
  }
}
