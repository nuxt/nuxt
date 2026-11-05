import type { Nuxt } from '@nuxt/schema'

/**
 * Compile-time constants of the Nuxt app for the client or server bundle.
 */
export function getNuxtDefines (nuxt: Nuxt, name: 'client' | 'server'): Record<string, string | boolean> {
  const isClient = name === 'client'
  const isServer = name === 'server'

  const define: Record<string, string | boolean> = {
    '__NUXT_VERSION__': JSON.stringify(nuxt._version),
    '__NUXT_ASYNC_CONTEXT__': nuxt.options.experimental.asyncContext,
    'process.env.VUE_ENV': JSON.stringify(name),
    'process.dev': nuxt.options.dev,
    'process.test': nuxt.options.test,
    'process.browser': isClient,
    'process.client': isClient,
    'process.server': isServer,
    'import.meta.dev': nuxt.options.dev,
    'import.meta.test': nuxt.options.test,
    'import.meta.browser': isClient,
    'import.meta.client': isClient,
    'import.meta.envName': JSON.stringify(nuxt.options.envName),
    'import.meta.server': isServer,
  }

  if (isClient) {
    define['process.prerender'] = false
    define['process.nitro'] = false
    define['import.meta.prerender'] = false
    define['import.meta.nitro'] = false
  } else {
    // wrap in an IIFE, forcing it to be evaluated at runtime
    define['process.prerender'] = '(()=>process.prerender)()'
    define['process.nitro'] = '(()=>process.nitro)()'
    define['import.meta.prerender'] = '(()=>import.meta.prerender)()'
    define['import.meta.nitro'] = '(()=>import.meta.nitro)()'
  }

  return define
}
