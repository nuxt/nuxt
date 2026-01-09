import type { NuxtHooks, NuxtMiddleware } from '@nuxt/schema'
import { defu } from 'defu'

import { useNuxt } from './context.ts'
import { isNuxtMajorVersion } from './compatibility.ts'
import { logger } from './logger.ts'
import type { NitroRouteConfig } from './nitro-types.ts'
import { toArray } from './utils.ts'

export function extendPages (cb: NuxtHooks['pages:extend']): void {
  const nuxt = useNuxt()
  if (isNuxtMajorVersion(2, nuxt)) {
    // @ts-expect-error TODO: Nuxt 2 hook
    nuxt.hook('build:extendRoutes', cb)
  } else {
    nuxt.hook('pages:extend', cb)
  }
}

export interface ExtendRouteRulesOptions {
  /**
   * Override route rule config
   * @default false
   */
  override?: boolean
}

export function extendRouteRules (route: string, rule: NitroRouteConfig, options: ExtendRouteRulesOptions = {}): void {
  const nuxt = useNuxt()
  for (const opts of [nuxt.options, nuxt.options.nitro]) {
    opts.routeRules ||= {}
    opts.routeRules[route] = options.override
      ? defu(rule, opts.routeRules[route] as any)
      : defu(opts.routeRules[route] as any, rule)
  }
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
