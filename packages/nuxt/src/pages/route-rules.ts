import type { Nuxt, NuxtPage, RouteRuleConfig } from '@nuxt/schema'

import { pageDiagnostics } from '@nuxt/kit/internal'
import { defu } from 'defu'
import { isEqual } from 'ohash'
import { vueRouterToRou3 } from 'unrouting'

import { normalizeAppMiddlewareRules } from '../core/utils/route-rules.ts'

/**
 * Merge the rules extracted from `defineRouteRules` into the server's route rules, replacing the
 * rules applied by the previous call.
 */
export function createInlineRouteRulesUpdater (nuxt: Nuxt) {
  let inlineRulesCache: Record<string, RouteRuleConfig> = {}
  const overwritten = new Map<string, RouteRuleConfig | undefined>()
  const applyInlineRules = (rules: Record<string, RouteRuleConfig>, inlineRules: Record<string, RouteRuleConfig>) => {
    for (const [route, previous] of overwritten) {
      if (previous === undefined) {
        delete rules[route]
      } else {
        rules[route] = previous
      }
    }
    overwritten.clear()
    for (const [route, inline] of Object.entries(inlineRules)) {
      overwritten.set(route, rules[route])
      rules[route] = defu(inline, rules[route])
    }
  }
  // without a server builder to register them with, the rules the build compiles are
  // the configured ones, so extracted rules are merged into the configuration itself
  let updateRouteConfig = (inlineRules: Record<string, RouteRuleConfig>): void | Promise<void> => {
    if (isEqual(inlineRulesCache, inlineRules)) { return }
    applyInlineRules((nuxt.options.routeRules ||= {}), inlineRules)
    inlineRulesCache = inlineRules
  }
  nuxt.hook('nitro:init', (nitro) => {
    updateRouteConfig = async (inlineRules) => {
      if (isEqual(inlineRulesCache, inlineRules)) { return }
      // TODO: merge onto `nitro.options._config?.routeRules` instead, without pre-normalising,
      // once `nitro.updateConfig()` re-applies the route rules derived from `publicAssets`
      const normalizedInlineRules: Record<string, Record<string, any>> = {}
      for (const [route, rule] of Object.entries(inlineRules as Record<string, Record<string, any>>)) {
        if (rule.swr === false) {
          normalizedInlineRules[route] = { ...rule, cache: rule.cache ? { ...rule.cache, swr: false } : false }
        } else if (rule.swr !== undefined && rule.cache === undefined) {
          normalizedInlineRules[route] = { ...rule, cache: { swr: true, ...typeof rule.swr === 'number' ? { maxAge: rule.swr } : {} } }
        } else {
          normalizedInlineRules[route] = rule
        }
      }
      normalizeAppMiddlewareRules(normalizedInlineRules)
      const routeRules: Record<string, RouteRuleConfig> = { ...(nitro.options as { routeRules?: Record<string, RouteRuleConfig> }).routeRules }
      normalizeAppMiddlewareRules(routeRules)
      applyInlineRules(routeRules, normalizedInlineRules)
      normalizeAppMiddlewareRules(routeRules)
      await nitro.updateConfig({ routeRules })
      inlineRulesCache = inlineRules
    }
  })
  return (pages: NuxtPage[]) => updateRouteConfig(globRouteRulesFromPages(pages))
}

export function globRouteRulesFromPages (pages: NuxtPage[]) {
  return collectRouteRulesFromPages(pages, {}, '')
}

function collectRouteRulesFromPages (
  pages: NuxtPage[],
  paths: Record<string, RouteRuleConfig>,
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
