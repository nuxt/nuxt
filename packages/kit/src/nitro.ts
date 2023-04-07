import type { Nitro, NitroDevEventHandler, NitroEventHandler } from 'nitropack'
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
export function addPrerenderRoutes (routes: string | string[]) {
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
