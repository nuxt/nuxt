import { Suspense, Transition, computed, defineComponent, h, inject, nextTick, onMounted, provide, reactive, ref } from 'vue'
import type { KeepAliveProps, TransitionProps, VNode } from 'vue'
import { RouterView } from '#vue-router'
import { defu } from 'defu'
import type { RouteLocation, RouteLocationNormalized, RouteLocationNormalizedLoaded } from '#vue-router'

import type { RouterViewSlotProps } from './utils'
import { generateRouteKey, wrapInKeepAlive } from './utils'
import { useNuxtApp } from '#app/nuxt'
import { _wrapIf } from '#app/components/utils'
import { LayoutMetaSymbol } from '#app/components/layout'
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
    const forkRoute = inject<RouteLocationNormalizedLoaded | null>('_route', null)

    expose({ pageRef })

    const _layoutMeta = inject(LayoutMetaSymbol, null)
    let vnode: VNode

    return () => {
      return h(RouterView, { name: props.name, route: props.route, ...attrs }, {
        default: (routeProps: RouterViewSlotProps) => {
          const isRenderingNewRouteInOldFork = process.client && haveParentRoutesRendered(forkRoute, routeProps.route, routeProps.Component)
          const hasSameChildren = process.client && forkRoute && forkRoute.matched.length === routeProps.route.matched.length

          if (!routeProps.Component) {
            // If we're rendering a `<NuxtPage>` child route on navigation to a route which lacks a child page
            // we'll render the old vnode until the new route finishes resolving
            if (process.client && vnode && !hasSameChildren) {
              return vnode
            }
            return
          }

          // Return old vnode if we are rendering _new_ page suspense fork in _old_ layout suspense fork
          if (process.client && vnode && _layoutMeta && !_layoutMeta.isCurrent(routeProps.route)) {
            return vnode
          }

          if (process.client && isRenderingNewRouteInOldFork && forkRoute && (!_layoutMeta || _layoutMeta?.isCurrent(forkRoute))) {
            // if leaving a route with an existing child route, render the old vnode
            if (hasSameChildren) {
              return vnode
            }
            // If _leaving_ null child route, return null vnode
            return null
          }

          const key = generateRouteKey(routeProps, props.pageKey)
          const done = nuxtApp.deferHydration()

          const hasTransition = !!(props.transition ?? routeProps.route.meta.pageTransition ?? defaultPageTransition)
          const transitionProps = hasTransition && _mergeTransitionProps([
            props.transition,
            routeProps.route.meta.pageTransition,
            defaultPageTransition,
            { onAfterLeave: () => { nuxtApp.callHook('page:transition:finish', routeProps.Component) } }
          ].filter(Boolean))

          vnode = _wrapIf(Transition, hasTransition && transitionProps,
            wrapInKeepAlive(props.keepalive ?? routeProps.route.meta.keepalive ?? (defaultKeepaliveConfig as KeepAliveProps), h(Suspense, {
              suspensible: true,
              onPending: () => nuxtApp.callHook('page:start', routeProps.Component),
              onResolve: () => { nextTick(() => nuxtApp.callHook('page:finish', routeProps.Component).finally(done)) }
            }, { default: () => h(RouteProvider, { key, routeProps, pageKey: key, hasTransition, pageRef } as {}) })
            )).default()

          return vnode
        }
      })
    }
  }
})

function _toArray (val: any) {
  return Array.isArray(val) ? val : (val ? [val] : [])
}

function _mergeTransitionProps (routeProps: TransitionProps[]): TransitionProps {
  const _props: TransitionProps[] = routeProps.map(prop => ({
    ...prop,
    onAfterLeave: _toArray(prop.onAfterLeave)
  }))
  return defu(..._props as [TransitionProps, TransitionProps])
}

const RouteProvider = defineComponent({
  name: 'RouteProvider',
  // TODO: Type props
  // eslint-disable-next-line vue/require-prop-types
  props: ['routeProps', 'pageKey', 'hasTransition', 'pageRef'],
  setup (props) {
    // Prevent reactivity when the page will be rerendered in a different suspense fork
    // eslint-disable-next-line vue/no-setup-props-destructure
    const previousKey = props.pageKey
    // eslint-disable-next-line vue/no-setup-props-destructure
    const previousRoute = props.routeProps.route

    // Provide a reactive route within the page
    const route = {} as RouteLocation
    for (const key in props.routeProps.route) {
      (route as any)[key] = computed(() => previousKey === props.pageKey ? props.routeProps.route[key] : previousRoute[key])
    }

    provide('_route', reactive(route))

    let vnode: VNode
    if (process.dev && process.client && props.hasTransition) {
      onMounted(() => {
        nextTick(() => {
          if (['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            const filename = (vnode?.type as any).__file
            console.warn(`[nuxt] \`${filename}\` does not have a single root node and will cause errors when navigating between routes.`)
          }
        })
      })
    }

    return () => {
      if (process.dev && process.client) {
        vnode = h(props.routeProps.Component, { ref: props.pageRef })
        return vnode
      }

      return h(props.routeProps.Component, { ref: props.pageRef })
    }
  }
})

function haveParentRoutesRendered (fork: RouteLocationNormalizedLoaded | null, newRoute: RouteLocationNormalizedLoaded, Component?: VNode) {
  if (!fork) { return false }

  const index = newRoute.matched.findIndex(m => m.components?.default === Component?.type)
  if (index === -1) { return true }

  // we only care whether the parent route components have had to rerender
  return newRoute.matched.slice(0, index)
    .some(
      (c, i) => c.components?.default !== fork.matched[i]?.components?.default) ||
        (Component && generateRouteKey({ route: newRoute, Component }) !== generateRouteKey({ route: fork, Component }))
}
