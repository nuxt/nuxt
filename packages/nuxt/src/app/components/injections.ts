import type { ComputedRef, InjectionKey } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface LayoutMeta {
  isCurrent: (route: RouteLocationNormalizedLoaded) => boolean
}

export const LayoutMetaSymbol: InjectionKey<LayoutMeta> = Symbol('layout-meta')

export const LayoutSymbol: InjectionKey<Readonly<ComputedRef<string | false>>> = Symbol('layout')

export const PageRouteSymbol: InjectionKey<RouteLocationNormalizedLoaded> = Symbol('route')
