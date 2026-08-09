import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitro/types'

import { pageDiagnostics } from '@nuxt/kit'
import { isEqual } from 'ohash'
import { vueRouterToRou3 } from 'unrouting'

export function globRouteRulesFromPages (pages: NuxtPage[]) {
  return collectRouteRulesFromPages(pages, {}, '')
}

function collectRouteRulesFromPages (
  pages: NuxtPage[],
  paths: Record<string, NitroRouteConfig>,
  prefix: string,
) {
  for (const page of pages) {
    if (page.rules) {
      if (Object.keys(page.rules).length) {
        const path = prefix + page.path
        const { patterns, issues } = vueRouterToRou3(path, { collapse: true })
        if (issues.length) {
          for (const issue of issues) {
            pageDiagnostics.NUXT_B4016({ path, detail: issue.message })
          }
        } else {
          for (const pattern of patterns) {
            if (pattern in paths && !isEqual(paths[pattern], page.rules)) {
              pageDiagnostics.NUXT_B4017({ path, pattern })
            }
            paths[pattern] = page.rules
          }
        }
      }
      // remove rules to prevent exposing in build
      delete page.rules
    }
    if (page.children?.length) {
      collectRouteRulesFromPages(page.children, paths, prefix + page.path + '/')
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
