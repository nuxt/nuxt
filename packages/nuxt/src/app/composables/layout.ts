import type { ComputedRef } from 'vue'
import { computed, inject, unref } from 'vue'
import type { NitroRouteRules } from 'nitropack/types'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import type { NuxtLayouts } from '../../pages/runtime/composables'
import { LayoutSymbol } from '../components/injections'
import { useRoute } from './router'

import _routeRulesMatcher from '#build/route-rules.mjs'

// `NitroRouteRules` has no index signature, and the generated `nitro-layouts.d.ts`
// template already declares `appLayout` with a narrowed `LayoutKey` type, so we widen
// locally rather than augmenting globally. Hoisted as a function declaration so a
// circular import cannot hit the TDZ of the `#build/route-rules.mjs` default export.
function routeRulesMatcher (path: string): NitroRouteRules & { appLayout?: string | false } {
  return (_routeRulesMatcher as (path: string) => NitroRouteRules & { appLayout?: string | false })(path)
}

export type LayoutName = keyof NuxtLayouts | 'default' | false

export function resolveLayoutName (route: Pick<RouteLocationNormalizedLoaded, 'meta' | 'path'> | undefined, name?: unknown): LayoutName {
  return (unref(name) as LayoutName | null | undefined) ?? route?.meta.layout as LayoutName ?? routeRulesMatcher(route?.path ?? '/').appLayout as LayoutName ?? 'default'
}

/**
 * Returns the layout rendered for the current route, resolved through the same chain as
 * `<NuxtLayout>` (page `layout` meta, then the route rules `appLayout`, then `default`).
 *
 * Within a rendered `<NuxtLayout>` it reflects the enclosing layout; outside of one it
 * returns the layout that would be resolved for the current route.
 * @since 4.5.0
 */
export function useLayout (): Readonly<ComputedRef<LayoutName>> {
  const injected = inject(LayoutSymbol, null)
  if (injected) {
    return injected as Readonly<ComputedRef<LayoutName>>
  }
  const route = useRoute()
  return computed(() => resolveLayoutName(route))
}
