import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitro/types'

import { isEqual } from 'ohash'
import { vueRouterToRou3 } from 'unrouting'

interface GlobRouteRulesFromPagesOptions {
  warn?: (message: string) => void
}

export function globRouteRulesFromPages (
  pages: NuxtPage[],
  options: GlobRouteRulesFromPagesOptions = {},
) {
  return collectRouteRulesFromPages(pages, {}, '', options)
}

function collectRouteRulesFromPages (
  pages: NuxtPage[],
  paths: Record<string, NitroRouteConfig>,
  prefix: string,
  options: GlobRouteRulesFromPagesOptions,
) {
  for (const page of pages) {
    if (page.rules) {
      if (Object.keys(page.rules).length) {
        const path = prefix + page.path
        const { patterns, issues } = vueRouterToRou3(path, { collapse: true })
        for (const issue of issues) {
          options.warn?.(`Inline route rules for \`${path}\` cannot be represented exactly by Nitro route rules: ${issue.message}.`)
        }
        for (const pattern of patterns) {
          if (pattern in paths && !isEqual(paths[pattern], page.rules)) {
            options.warn?.(`Inline route rules for \`${path}\` generated \`${pattern}\`, which is already used by another page. The later inline route rules will override the earlier ones.`)
          }
          paths[pattern] = page.rules
        }
      }
      // remove rules to prevent exposing in build
      delete page.rules
    }
    if (page.children?.length) {
      collectRouteRulesFromPages(page.children, paths, prefix + page.path + '/', options)
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
