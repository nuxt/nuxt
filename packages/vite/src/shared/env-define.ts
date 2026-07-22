import type { Nuxt } from 'nuxt/schema'

export function supportsLegacyProcessFlags (compatibilityVersion: number) {
  return compatibilityVersion < 5
}

export function getClientEnvDefine (nuxt: Nuxt) {
  const legacyProcessFlags = supportsLegacyProcessFlags(nuxt.options.future.compatibilityVersion)

  return {
    'process.env.NODE_ENV': JSON.stringify(nuxt.options.vite.mode),
    ...(legacyProcessFlags
      ? {
          'process.server': false,
          'process.client': true,
          'process.browser': true,
        }
      : {}),
    'process.nitro': false,
    'process.prerender': false,
    'import.meta.server': false,
    'import.meta.client': true,
    'import.meta.browser': true,
    'import.meta.envName': JSON.stringify(nuxt.options.envName),
    'import.meta.nitro': false,
    'import.meta.prerender': false,
    'module.hot': false,
    ...nuxt.options.experimental.clientNodeCompat ? { global: 'globalThis' } : {},
  }
}

export function getSsrEnvDefine (nuxt: Nuxt) {
  const legacyProcessFlags = supportsLegacyProcessFlags(nuxt.options.future.compatibilityVersion)

  return {
    'process.env.NODE_ENV': JSON.stringify(nuxt.options.vite.mode),
    ...(legacyProcessFlags
      ? {
          'process.server': true,
          'process.client': false,
          'process.browser': false,
        }
      : {}),
    'import.meta.server': true,
    'import.meta.client': false,
    'import.meta.browser': false,
    'import.meta.envName': JSON.stringify(nuxt.options.envName),
  }
}
