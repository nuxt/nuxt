import { Component, KeepAlive, h } from 'vue'
import { RouterView, RouteLocationMatched, RouteLocationNormalizedLoaded } from 'vue-router'

type InstanceOf<T> = T extends new (...args: any[]) => infer R ? R : never
export type RouterViewSlotProps = Parameters<InstanceOf<typeof RouterView>['$slots']['default']>[0]

const interpolatePath = (route: RouteLocationNormalizedLoaded, match: RouteLocationMatched) => {
  return match.path
    .replace(/(?<=:\w+)\([^)]+\)/g, '')
    .replace(/(?<=:\w+)[?+*]/g, '')
    .replace(/:\w+/g, r => route.params[r.slice(1)]?.toString() || '')
}

export const generateRouteKey = (override: string | ((route: RouteLocationNormalizedLoaded) => string), routeProps: RouterViewSlotProps) => {
  const matchedRoute = routeProps.route.matched.find(m => m.components.default === routeProps.Component.type)
  const source = override ?? matchedRoute?.meta.key ?? interpolatePath(routeProps.route, matchedRoute)
  return typeof source === 'function' ? source(routeProps.route) : source
}

const Fragment = {
  setup (_props, { slots }) {
    return () => slots.default()
  }
}

export const wrapIf = (component: Component, props: any, slots: any) => {
  return { default: () => props ? h(component, props === true ? {} : props, slots) : h(Fragment, {}, slots) }
}

export const wrapInKeepAlive = (props: any, children: any) => {
  return { default: () => process.client && props ? h(KeepAlive, props === true ? {} : props, children) : children }
}
