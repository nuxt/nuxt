import type { Middleware } from 'h3'
import type { NitroEventHandler, NitroDevEventHandler } from 'nitropack'
import { useNuxt } from './context'

export interface LegacyServerMiddleware {
  route?: string,
  path?: string,
  handle?: Middleware | string
  handler: Middleware | string
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
