import type { NodeMiddleware } from 'h3'
import type { NitroEventHandler, NitroDevEventHandler, Nitro } from 'nitropack'
import { useNuxt } from './context'

export interface LegacyServerMiddleware {
  route?: string,
  path?: string,
  handle?: NodeMiddleware | string
  handler: NodeMiddleware | string
}

/**
 * normalize handler object
 *
 */
function normalizeHandlerMethod (handler: NitroEventHandler) {
  // retrieve method from handler file name
  const [, method = undefined] = handler.handler.match(/\.(get|head|patch|post|put|delete|connect|options|trace)(\.\w+)*$/) || []
  return {
    method,
    ...handler
  }
}

/**
 * Adds a new server middleware to the end of the server middleware array.
 *
 * @deprecated Use addServerHandler instead
 */
export function addServerMiddleware (middleware: LegacyServerMiddleware) {
  useNuxt().options.serverMiddleware.push(middleware)
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
