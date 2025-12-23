import type { NuxtHooks, NuxtMiddleware } from '@nuxt/schema'
import { useNuxt } from './context.ts'
import { logger } from './logger.ts'
import { toArray } from './utils.ts'

export { extendRouteRules } from './route-rules.ts'
export type { ExtendRouteRulesOptions, RouteRulesHandle } from './route-rules.ts'

export function extendPages (cb: NuxtHooks['pages:extend']): void {
  useNuxt().hook('pages:extend', cb)
}

export interface AddRouteMiddlewareOptions {
  /**
   * Override existing middleware with the same name, if it exists
   * @default false
   */
  override?: boolean
  /**
   * Prepend middleware to the list
   * @default false
   */
  prepend?: boolean
}

export function addRouteMiddleware (input: NuxtMiddleware | NuxtMiddleware[], options: AddRouteMiddlewareOptions = {}): void {
  const nuxt = useNuxt()
  const middlewares = toArray(input)
  nuxt.hook('app:resolve', (app) => {
    for (const middleware of middlewares) {
      const find = app.middleware.findIndex(item => item.name === middleware.name)
      if (find >= 0) {
        const foundPath = app.middleware[find]!.path
        if (foundPath === middleware.path) { continue }
        if (options.override === true) {
          app.middleware[find] = { ...middleware }
        } else {
          logger.warn(`'${middleware.name}' middleware already exists at '${foundPath}'. You can set \`override: true\` to replace it.`)
        }
      } else if (options.prepend === true) {
        app.middleware.unshift({ ...middleware })
      } else {
        app.middleware.push({ ...middleware })
      }
    }
  })
}
