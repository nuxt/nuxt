import type { NuxtPage } from '@nuxt/schema'
import type { NitroRouteConfig } from 'nitro/types'

import { isEqual } from 'ohash'

import { pathToNitroGlobs } from './utils.ts'

interface GlobRouteRulesFromPagesOptions {
  warn?: (message: string) => void
}

export function globRouteRulesFromPages (pages: NuxtPage[], paths = {} as { [glob: string]: NitroRouteConfig }, prefix = '', options: GlobRouteRulesFromPagesOptions = {}) {
  for (const page of pages) {
    if (page.rules) {
      if (Object.keys(page.rules).length) {
        const path = prefix + page.path
        const globs = pathToNitroGlobs(path, { warn: options.warn })
        for (const glob of globs || []) {
          if (glob in paths && !isEqual(paths[glob], page.rules)) {
            options.warn?.(`Inline route rules for \`${path}\` generated \`${glob}\`, which is already used by another page. The later inline route rules will override the earlier ones.`)
          }
          paths[glob] = page.rules
        }
      }
      // remove rules to prevent exposing in build
      delete page.rules
    }
    if (page.children?.length) {
      globRouteRulesFromPages(page.children, paths, prefix + page.path + '/', options)
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
