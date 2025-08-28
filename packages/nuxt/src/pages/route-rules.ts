import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitro/types'

import { pathToNitroGlob } from './utils'

export function globRouteRulesFromPages (pages: NuxtPage[], paths = {} as { [glob: string]: NitroRouteConfig }, prefix = '') {
  for (const page of pages) {
    if (page.rules) {
      if (Object.keys(page.rules).length) {
        const glob = pathToNitroGlob(prefix + page.path)
        if (glob) {
          paths[glob] = page.rules
        }
      }
      // remove rules to prevent exposing in build
      delete page.rules
    }
    if (page.children?.length) {
      globRouteRulesFromPages(page.children, paths, prefix + page.path + '/')
    }
  }
  return paths
}

export function removePagesRules (routes: NuxtPage[]) {
  for (const route of routes) {
    delete route.rules
    if (route.children?.length) {
      removePagesRules(route.children)
    }
  }
}
