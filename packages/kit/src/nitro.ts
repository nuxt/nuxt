import type { Nitro, NitroDevEventHandler, NitroEventHandler } from 'nitropack'
import type { Import } from 'unimport'
import { normalize } from 'pathe'
import { useNuxt } from './context'

/**
 * normalize handler object
 *
 */
function normalizeHandlerMethod (handler: NitroEventHandler) {
  // retrieve method from handler file name
  const [, method = undefined] = handler.handler.match(/\.(get|head|patch|post|put|delete|connect|options|trace)(\.\w+)*$/) || []
  return {
    method,
    ...handler,
    handler: normalize(handler.handler)
  }
}

/**
 * Adds a nitro server handler
 *
 */
export function addServerHandler (handler: NitroEventHandler) {
  useNuxt().options.serverHandlers.push(normalizeHandlerMethod(handler))
}

/**
 * Adds a nitro server handler for development-only
 *
 */
export function addDevServerHandler (handler: NitroDevEventHandler) {
  useNuxt().options.devServerHandlers.push(handler)
}

/**
 * Adds a Nitro plugin
 */
export function addServerPlugin (plugin: string) {
  const nuxt = useNuxt()
  nuxt.options.nitro.plugins = nuxt.options.nitro.plugins || []
  nuxt.options.nitro.plugins.push(normalize(plugin))
}

/**
 * Adds routes to be prerendered
 */
export function prerenderRoutes (routes: string | string[]) {
  const nuxt = useNuxt()
  if (!Array.isArray(routes)) {
    routes = [routes]
  }
  routes = routes.filter(Boolean)
  if (!routes.length) {
    return
  }
  nuxt.hook('prerender:routes', (ctx) => {
    for (const route of routes) {
      ctx.routes.add(route)
    }
  })
}

/**
 * Access to the Nitro instance
 *
 * **Note:** You can call `useNitro()` only after `ready` hook.
 *
 * **Note:** Changes to the Nitro instance configuration are not applied.
 *
 * @example
 *
 * ```ts
 * nuxt.hook('ready', () => {
 *   console.log(useNitro())
 * })
 * ```
 */
export function useNitro (): Nitro {
  const nuxt = useNuxt()
  if (!(nuxt as any)._nitro) {
    throw new Error('Nitro is not initialized yet. You can call `useNitro()` only after `ready` hook.')
  }
  return (nuxt as any)._nitro
}

/**
 * Add server imports to be auto-imported by Nitro
 */
export function addServerImports (imports: Import[]) {
  const nuxt = useNuxt()
  nuxt.hook('nitro:config', (config) => {
    config.imports = config.imports || {}
    config.imports.autoImport = true
    if (Array.isArray(config.imports.imports)) {
      config.imports.imports = [...config.imports.imports, ...imports]
    } else {
      config.imports.imports = [config.imports.imports, ...imports]
    }
  })
}

/**
 * Add directories to be scanned by Nitro
 */
export function addServerImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}) {
  const nuxt = useNuxt()
  nuxt.hook('nitro:config', (config) => {
    config.scanDirs = config.scanDirs || []

    for (const dir of (Array.isArray(dirs) ? dirs : [dirs])) {
      config.scanDirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
