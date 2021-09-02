/**
 * NuxtOptionsGlobals
 * Documentation: https://nuxtjs.org/api/configuration-globals
 */

 NuxtOptionsCustomizableGlobalName = 'id' | 'nuxt' | 'context' | 'pluginPrefix' | 'readyCallback' | 'loadedCallback'
export  NuxtOptionsGlobals = { [key in NuxtOptionsCustomizableGlobalName]?: (globalName: string) => string }
