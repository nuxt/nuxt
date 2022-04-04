import type { Middleware } from 'h3'
import { useNuxt } from './context'

export interface ServerMiddleware {
  path?: string,
  handler: Middleware | string
}

/** Adds a new server middleware to the end of the server middleware array. */
export function addServerMiddleware (middleware: ServerMiddleware) {
  useNuxt().options.serverMiddleware.push(middleware)
}
