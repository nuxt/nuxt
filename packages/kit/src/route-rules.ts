import type { Nuxt } from '@nuxt/schema'
import type { NitroRouteConfig, NitroRouteRules } from 'nitropack/types'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'
import { isEqual } from 'ohash'
import { useNuxt } from './context.ts'
import { tryUseNitro } from './nitro.ts'

const _routeRulesMatcherKey = Symbol.for('nuxt-kit:routeRulesMatcher')
const _nitroRouteRulesCache = Symbol.for('nuxt-kit:nitroRouteRulesCache')
const _routeRulesStack = Symbol.for('nuxt-kit:routeRulesStack')

interface RouteRuleStackEntry {
  id: symbol
  route: string
  rule: NitroRouteConfig
  order: number
}

export interface RouteRulesHandle {
  remove: () => Promise<void>
  update: (rules: Record<string, NitroRouteConfig>) => Promise<void>
}

/**
 * Get merged route rules for a path
 *
 * @example
 * ```ts
 * const rules = getRouteRules('/api/test')
 * ```
 */
export function getRouteRules (path: string): NitroRouteRules {
  const nuxt = useNuxt()
  const nitro = tryUseNitro()
  const rules = nitro?.options.routeRules ?? nuxt.options.nitro.routeRules

  let cache = (nuxt as any)[_routeRulesMatcherKey] as { matcher: ReturnType<typeof toRouteMatcher> } | undefined
  if (!cache) {
    cache = { matcher: toRouteMatcher(createRadixRouter({ routes: rules })) }
    ;(nuxt as any)[_routeRulesMatcherKey] = cache
  }

  return defu({}, ...cache.matcher.matchAll(path).reverse()) as NitroRouteRules
}

async function rebuildNitroRouteRules (nuxt: Nuxt, nitro: NonNullable<ReturnType<typeof tryUseNitro>>): Promise<void> {
  const stack: RouteRuleStackEntry[] = (nuxt as any)[_routeRulesStack] || []
  const baseRules = nitro.options._config?.routeRules || {}

  // Sort by order ascending (lower = base, processed first)
  const sorted = [...stack].sort((a, b) => a.order - b.order)

  // Build merged rules - later entries (higher order) override earlier
  const merged: Record<string, NitroRouteConfig> = { ...baseRules }
  for (const entry of sorted) {
    merged[entry.route] = merged[entry.route]
      ? { ...merged[entry.route], ...entry.rule }
      : entry.rule
  }

  const cached = (nuxt as any)[_nitroRouteRulesCache]
  if (!isEqual(cached, merged)) {
    await nitro.updateConfig({ routeRules: merged })
    ;(nuxt as any)[_nitroRouteRulesCache] = merged
  }
}

export interface ExtendRouteRulesOptions {
  /** @deprecated Use `order` instead. When true, sets order to 10. */
  override?: boolean
  /**
   * Priority order for rule merging. Higher values take precedence.
   * @default 0
   */
  order?: number
}

function addRulesToStack (
  nuxt: Nuxt,
  stack: RouteRuleStackEntry[],
  rules: Record<string, NitroRouteConfig>,
  groupId: symbol,
  order: number,
): void {
  for (const [route, rule] of Object.entries(rules)) {
    stack.push({ id: groupId, route, rule, order })
    for (const target of [nuxt.options, nuxt.options.nitro]) {
      target.routeRules ||= {}
      target.routeRules[route] = defu(target.routeRules[route], rule)
    }
  }
  delete (nuxt as any)[_routeRulesMatcherKey]
}

async function extendRouteRulesInternal (
  rules: Record<string, NitroRouteConfig>,
  options?: ExtendRouteRulesOptions,
): Promise<RouteRulesHandle> {
  const nuxt = useNuxt()
  const stack: RouteRuleStackEntry[] = (nuxt as any)[_routeRulesStack] ||= []
  const groupId = Symbol()

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const order = options?.order ?? (options?.override ? 10 : 0)

  const removeGroupFromStack = () => {
    let removed = false
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]!.id === groupId) {
        stack.splice(i, 1)
        removed = true
      }
    }
    return removed
  }

  const handle: RouteRulesHandle = {
    remove: async () => {
      if (!removeGroupFromStack()) { return }
      delete (nuxt as any)[_routeRulesMatcherKey]
      const nitro = tryUseNitro()
      if (nitro) { await rebuildNitroRouteRules(nuxt, nitro) }
    },
    update: async (newRules: Record<string, NitroRouteConfig>) => {
      removeGroupFromStack()
      addRulesToStack(nuxt, stack, newRules, groupId, order)
      const nitro = tryUseNitro()
      if (nitro) { await rebuildNitroRouteRules(nuxt, nitro) }
    },
  }

  await handle.update(rules)
  return handle
}

/**
 * Extend route rules at build time
 *
 * Returns a handle with `remove()` and `update()` methods for managing the rules.
 */
export async function extendRouteRules (route: string, rule: NitroRouteConfig, options?: ExtendRouteRulesOptions): Promise<RouteRulesHandle>
export async function extendRouteRules (rules: Record<string, NitroRouteConfig>, options?: ExtendRouteRulesOptions): Promise<RouteRulesHandle>
export function extendRouteRules (
  routeOrRules: string | Record<string, NitroRouteConfig>,
  ruleOrOptions?: NitroRouteConfig | ExtendRouteRulesOptions,
  options?: ExtendRouteRulesOptions,
): Promise<RouteRulesHandle> {
  if (typeof routeOrRules === 'object') {
    return extendRouteRulesInternal(routeOrRules, ruleOrOptions as ExtendRouteRulesOptions | undefined)
  }
  return extendRouteRulesInternal({ [routeOrRules]: ruleOrOptions as NitroRouteConfig }, options)
}
