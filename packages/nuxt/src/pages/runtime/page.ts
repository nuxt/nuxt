import { Suspense, Transition, defineComponent, h, inject, nextTick, ref, watch } from 'vue'
import type { KeepAliveProps, TransitionProps, VNode } from 'vue'
import { RouterView } from '#vue-router'
import { defu } from 'defu'
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded } from '#vue-router'

import { toArray } from './utils'
import type { RouterViewSlotProps } from './utils'
import { generateRouteKey, wrapInKeepAlive } from './utils'
import { RouteProvider } from '#app/components/route-provider'
import { useNuxtApp } from '#app/nuxt'
import { _wrapIf } from '#app/components/utils'
import { LayoutMetaSymbol, PageRouteSymbol } from '#app/components/injections'
// @ts-expect-error virtual file
import { appKeepalive as defaultKeepaliveConfig, appPageTransition as defaultPageTransition } from '#build/nuxt.config.mjs'

export default defineComponent({
  name: 'NuxtPage',
  inheritAttrs: false,
  props: {
    name: {
      type: String
    },
    transition: {
      type: [Boolean, Object] as any as () => boolean | TransitionProps,
      default: undefined
    },
    keepalive: {
      type: [Boolean, Object] as any as () => boolean | KeepAliveProps,
      default: undefined
    },
    route: {
      type: Object as () => RouteLocationNormalized
    },
    pageKey: {
      type: [Function, String] as unknown as () => string | ((route: RouteLocationNormalizedLoaded) => string),
      default: null
    }
  },
  setup (props, { attrs, expose }) {
    const nuxtApp = useNuxtApp()
    const pageRef = ref()
    const forkRoute = inject(PageRouteSymbol, null)
    let previousPageKey: string | undefined | false

    expose({ pageRef })

    const _layoutMeta = inject(LayoutMetaSymbol, null)
    let vnode: VNode

    const done = nuxtApp.deferHydration()

    if (props.pageKey) {
      watch(() => props.pageKey, (next, prev) => {
        if (next !== prev) {
          nuxtApp.callHook('page:loading:start')
        }
      })
    }

    return () => {
      return h(RouterView, { name: props.name, route: props.route, ...attrs }, {
        default: (routeProps: RouterViewSlotProps) => {
          const isRenderingNewRouteInOldFork = import.meta.client && haveParentRoutesRendered(forkRoute, routeProps.route, routeProps.Component)
          const hasSameChildren = import.meta.client && forkRoute && forkRoute.matched.length === routeProps.route.matched.length

          if (!routeProps.Component) {
            // If we're rendering a `<NuxtPage>` child route on navigation to a route which lacks a child page
            // we'll render the old vnode until the new route finishes resolving
            if (import.meta.client && vnode && !hasSameChildren) {
              return vnode
            }
            done()
            return
          }

          // Return old vnode if we are rendering _new_ page suspense fork in _old_ layout suspense fork
          if (import.meta.client && vnode && _layoutMeta && !_layoutMeta.isCurrent(routeProps.route)) {
            return vnode
          }

          if (import.meta.client && isRenderingNewRouteInOldFork && forkRoute && (!_layoutMeta || _layoutMeta?.isCurrent(forkRoute))) {
            // if leaving a route with an existing child route, render the old vnode
            if (hasSameChildren) {
              return vnode
            }
            // If _leaving_ null child route, return null vnode
            return null
          }

          const key = generateRouteKey(routeProps, props.pageKey)
          if (!nuxtApp.isHydrating && !hasChildrenRoutes(forkRoute, routeProps.route, routeProps.Component) && previousPageKey === key) {
            nuxtApp.callHook('page:loading:end')
          }
          previousPageKey = key

          const hasTransition = !!(props.transition ?? routeProps.route.meta.pageTransition ?? defaultPageTransition)
          const transitionProps = hasTransition && _mergeTransitionProps([
            props.transition,
            routeProps.route.meta.pageTransition,
            defaultPageTransition,
            { onAfterLeave: () => { nuxtApp.callHook('page:transition:finish', routeProps.Component) } }
          ].filter(Boolean))

          const keepaliveConfig = props.keepalive ?? routeProps.route.meta.keepalive ?? (defaultKeepaliveConfig as KeepAliveProps)
          vnode = _wrapIf(Transition, hasTransition && transitionProps,
            wrapInKeepAlive(keepaliveConfig, h(Suspense, {
              suspensible: true,
              onPending: () => nuxtApp.callHook('page:start', routeProps.Component),
              onResolve: () => { nextTick(() => nuxtApp.callHook('page:finish', routeProps.Component).then(() => nuxtApp.callHook('page:loading:end')).finally(done)) }
            }, {
              default: () => {
                const providerVNode = h(RouteProvider, {
                  key: key || undefined,
                  vnode: routeProps.Component,
                  route: routeProps.route,
                  renderKey: key || undefined,
                  trackRootNodes: hasTransition,
                  vnodeRef: pageRef
                })
                if (import.meta.client && keepaliveConfig) {
                  (providerVNode.type as any).name = (routeProps.Component.type as any).name || (routeProps.Component.type as any).__name || 'RouteProvider'
                }
                return providerVNode
              }
            })
            )).default()

          return vnode
        }
      })
    }
  }
})

function _mergeTransitionProps (routeProps: TransitionProps[]): TransitionProps {
  const _props: TransitionProps[] = routeProps.map(prop => ({
    ...prop,
    onAfterLeave: prop.onAfterLeave ? toArray(prop.onAfterLeave) : undefined
  }))
  return defu(..._props as [TransitionProps, TransitionProps])
}

function haveParentRoutesRendered (fork: RouteLocationNormalizedLoaded | null, newRoute: RouteLocationNormalizedLoaded, Component?: VNode) {
  if (!fork) { return false }

  const index = newRoute.matched.findIndex(m => m.components?.default === Component?.type)
  if (!index || index === -1) { return false }

  // we only care whether the parent route components have had to rerender
  return newRoute.matched.slice(0, index)
    .some(
      (c, i) => c.components?.default !== fork.matched[i]?.components?.default) ||
        (Component && generateRouteKey({ route: newRoute, Component }) !== generateRouteKey({ route: fork, Component }))
}

function hasChildrenRoutes (fork: RouteLocationNormalizedLoaded | null, newRoute: RouteLocationNormalizedLoaded, Component?: VNode) {
  if (!fork) { return false }

  const index = newRoute.matched.findIndex(m => m.components?.default === Component?.type)
  return index < newRoute.matched.length -1
}