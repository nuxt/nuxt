/**
 * NuxtOptionsGlobals
 * Documentation: https://nuxtjs.org/api/configuration-globals
 */

type NuxtOptionsCustomizableGlobalName = 'id' | 'nuxt' | 'context' | 'pluginPrefix' | 'readyCallback' | 'loadedCallback'
export type NuxtOptionsGlobals = { [key in NuxtOptionsCustomizableGlobalName]?: (globalName: string) => string }
