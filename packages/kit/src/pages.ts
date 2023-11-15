import { type NuxtHooks, type NuxtMiddleware } from '@nuxt/schema'
import { type NitroRouteConfig } from 'nitropack'
import { defu } from 'defu'
import { useNuxt } from './context'
import { isNuxt2 } from './compatibility'
import { logger } from './logger'
import { toArray } from './utils'

export function extendPages(callback: NuxtHooks['pages:extend']) {
  const nuxt = useNuxt()

  if (isNuxt2(nuxt)) {
    // @ts-expect-error TODO: Nuxt 2 hook
    nuxt.hook('build:extendRoutes', callback)
  } else {
    nuxt.hook('pages:extend', callback)
  }
}

export interface ExtendRouteRulesOptions {
  /**
   * Override route rule config
   * @default false
   */
  override?: boolean
}

export function extendRouteRules(
  route: string,
  rule: NitroRouteConfig,
  options: ExtendRouteRulesOptions = {}
) {
  const nuxt = useNuxt()

  for (const options_ of [nuxt.options, nuxt.options.nitro]) {
    if (!options_.routeRules) {
      options_.routeRules = {}
    }

    options_.routeRules[route] = options.override
      ? defu(rule, options_.routeRules[route])
      : defu(options_.routeRules[route], rule)
  }
}

export interface AddRouteMiddlewareOptions {
  /**
   * Override existing middleware with the same name, if it exists
   * @default false
   */
  override?: boolean
}

export function addRouteMiddleware(
  input: NuxtMiddleware | NuxtMiddleware[],
  options: AddRouteMiddlewareOptions = {}
) {
  const nuxt = useNuxt()
  const middlewares = toArray(input)

  nuxt.hook('app:resolve', (app) => {
    for (const middleware of middlewares) {
      const find = app.middleware.findIndex(
        (item) => item.name === middleware.name
      )

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
