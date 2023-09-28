import type { NuxtHooks, NuxtMiddleware } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitropack'
import { defu } from 'defu'
import { useNuxt } from './context'
import { isNuxt2 } from './compatibility'
import { logger } from './logger'

export function extendPages (cb: NuxtHooks['pages:extend']) {
  const nuxt = useNuxt()
  if (isNuxt2(nuxt)) {
    // @ts-expect-error TODO: Nuxt 2 hook
    nuxt.hook('build:extendRoutes', cb)
  } else {
    nuxt.hook('pages:extend', cb)
  }
}

export interface ExtendRouteRulesOptions {
  /**
   * Override route rule config
   *
   * @default false
   */
  override?: boolean
}

export function extendRouteRules (route: string, rule: NitroRouteConfig, options: ExtendRouteRulesOptions = {}) {
  const nuxt = useNuxt()
  for (const opts of [nuxt.options, nuxt.options.nitro]) {
    if (!opts.routeRules) {
      opts.routeRules = {}
    }
    opts.routeRules[route] = options.override
      ? defu(rule, opts.routeRules[route])
      : defu(opts.routeRules[route], rule)
  }
}

export interface AddRouteMiddlewareOptions {
  /**
   * Override existing middleware with the same name, if it exists
   *
   * @default false
   */
  override?: boolean
}

export function addRouteMiddleware (input: NuxtMiddleware | NuxtMiddleware[], options: AddRouteMiddlewareOptions = {}) {
  const nuxt = useNuxt()
  const middlewares = Array.isArray(input) ? input : [input]
  nuxt.hook('app:resolve', (app) => {
    for (const middleware of middlewares) {
      const find = app.middleware.findIndex(item => item.name === middleware.name)
      if (find >= 0) {
        if (options.override === true) {
          app.middleware[find] = middleware
        } else {
          logger.warn(`'${middleware.name}' middleware already exists at '${app.middleware[find].path}'. You can set \`override: true\` to replace it.`)
        }
      } else {
        app.middleware.push(middleware)
      }
    }
  })
}
