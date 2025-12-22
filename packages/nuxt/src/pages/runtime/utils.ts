import { KeepAlive, h } from 'vue'
import type { RouteLocationMatched, RouteLocationNormalizedLoaded, RouterView } from 'vue-router'

type InstanceOf<T> = T extends new (...args: any[]) => infer R ? R : never
type RouterViewSlot = Exclude<InstanceOf<typeof RouterView>['$slots']['default'], undefined>
export type RouterViewSlotProps = Parameters<RouterViewSlot>[0]

type SerializablePrimitive = string | number | boolean | null | undefined

/** JSON-serializable value (non-recursive definition to avoid excessive type depth) */
export type SerializableValue = SerializablePrimitive | SerializablePrimitive[] | Record<string, unknown>

/** Constrains T to only contain serializable properties. Non-serializable properties become `never`. */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type MakeSerializableObject<T> = T extends Function | symbol ? never : {
  [K in keyof T]: T[K] extends SerializablePrimitive
    ? T[K]
    : T[K] extends (infer U)[]
      ? U extends SerializablePrimitive ? T[K] : never
      : T[K] extends Record<string, unknown>
        ? T[K]
        : never
}

const ROUTE_KEY_PARENTHESES_RE = /(:\w+)\([^)]+\)/g
const ROUTE_KEY_SYMBOLS_RE = /(:\w+)[?+*]/g
const ROUTE_KEY_NORMAL_RE = /:\w+/g
const interpolatePath = (route: RouteLocationNormalizedLoaded, match: RouteLocationMatched) => {
  return match.path
    .replace(ROUTE_KEY_PARENTHESES_RE, '$1')
    .replace(ROUTE_KEY_SYMBOLS_RE, '$1')
    .replace(ROUTE_KEY_NORMAL_RE, r => route.params[r.slice(1)]?.toString() || '')
}

export const generateRouteKey = (routeProps: RouterViewSlotProps, override?: string | ((route: RouteLocationNormalizedLoaded) => string)) => {
  const matchedRoute = routeProps.route.matched.find(m => m.components?.default === routeProps.Component.type)
  const source = override ?? matchedRoute?.meta.key ?? (matchedRoute && interpolatePath(routeProps.route, matchedRoute))
  return typeof source === 'function' ? source(routeProps.route) : source
}

export const wrapInKeepAlive = (props: any, children: any) => {
  return { default: () => import.meta.client && props ? h(KeepAlive, props === true ? {} : props, children) : children }
}

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}
