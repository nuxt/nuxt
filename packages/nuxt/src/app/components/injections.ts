import type { ComputedRef, InjectionKey } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface LayoutMeta {
  isCurrent: (route: RouteLocationNormalizedLoaded) => boolean
}

// Registered globally (`Symbol.for`) so duplicated copies of the Nuxt runtime
// (e.g. a layer with its own `nuxt` dependency) share these injection keys.
export const LayoutMetaSymbol: InjectionKey<LayoutMeta> = Symbol.for('nuxt:layout-meta')

export const LayoutSymbol: InjectionKey<Readonly<ComputedRef<string | false>>> = Symbol.for('nuxt:layout')

export const PageRouteSymbol: InjectionKey<RouteLocationNormalizedLoaded> = Symbol.for('nuxt:route')
