import { useNuxt } from './context'

/** Adds a new server middleware to the end of the server middleware array. */
export function addServerMiddleware (middleware) {
  useNuxt().options.serverMiddleware.push(middleware)
}
