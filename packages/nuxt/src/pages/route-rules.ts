import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitropack/types'

import { pathToNitroGlob } from './utils.ts'
import { addRoute, createRouter } from 'rou3'
import { compileRouter } from 'rou3/compiler'

export function globRouteRulesFromPages (pages: NuxtPage[], paths = {} as { [glob: string]: NitroRouteConfig }, prefix = '', router = createRouter()) {
  for (const page of pages) {
    if (page.rules) {
      if (Object.keys(page.rules).length) {
        const glob = pathToNitroGlob(prefix + page.path)
        if (glob) {
          paths[glob] = page.rules
          addRoute(router, undefined, glob, page.rules)
        }
      }
      // remove rules to prevent exposing in build
      delete page.rules
    }
    if (page.children?.length) {
      globRouteRulesFromPages(page.children, paths, prefix + page.path + '/', router)
    }
  }

  // compile router at the end
  const matcher = compileRouter(router)

  return { paths, matcher }
}

export function removePagesRules (routes: NuxtPage[]) {
  for (const route of routes) {
    delete route.rules
    if (route.children?.length) {
      removePagesRules(route.children)
    }
  }
}
