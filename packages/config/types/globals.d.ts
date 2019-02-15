/**
 * NuxtConfigurationGlobals
 * Documentation: https://nuxtjs.org/api/configuration-globals
 */

type NuxtConfigurationCustomizableGlobalName = 'id' | 'nuxt' | 'context' | 'pluginPrefix' | 'readyCallback' | 'loadedCallback'
export type NuxtConfigurationGlobals = { [key in NuxtConfigurationCustomizableGlobalName]?: (globalName: string) => string }
