import { Fragment, Suspense, defineComponent, h, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AllowedComponentProps, Component, ComponentCustomProps, ComponentPublicInstance, KeepAliveProps, Slot, TransitionProps, VNode, VNodeProps } from 'vue'
import { RouterView } from 'vue-router'
import { defu } from 'defu'
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded, RouterViewProps } from 'vue-router'

import { generateRouteKey, toArray, wrapInKeepAlive } from './utils'
import type { RouterViewSlotProps } from './utils'
import { RouteProvider, defineRouteProvider } from '#app/components/route-provider'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { _wrapInTransition } from '#app/components/utils'
import { LayoutMetaSymbol, PageRouteSymbol } from '#app/components/injections'
// @ts-expect-error virtual file
import { appKeepalive as defaultKeepaliveConfig, appPageTransition as defaultPageTransition } from '#build/nuxt.config.mjs'

export interface NuxtPageProps extends RouterViewProps {
  /**
   * Define global transitions for all pages rendered with the `NuxtPage` component.
   */
  transition?: boolean | TransitionProps

  /**
   * Control state preservation of pages rendered with the `NuxtPage` component.
   */
  keepalive?: boolean | KeepAliveProps

  /**
   * Control when the `NuxtPage` component is re-rendered.
   */
  pageKey?: string | ((route: RouteLocationNormalizedLoaded) => string)
}

const _routeProviders = import.meta.dev ? new Map<string, ReturnType<typeof defineRouteProvider> | undefined>() : new WeakMap<Component, ReturnType<typeof defineRouteProvider> | undefined>()

export default defineComponent({
  name: 'NuxtPage',
  inheritAttrs: false,
  props: {
    name: {
      type: String,
    },
    transition: {
      type: [Boolean, Object] as any as () => boolean | TransitionProps,
      default: undefined,
    },
    keepalive: {
      type: [Boolean, Object] as any as () => boolean | KeepAliveProps,
      default: undefined,
    },
    route: {
      type: Object as () => RouteLocationNormalized,
    },
    pageKey: {
      type: [Function, String] as unknown as () => string | ((route: RouteLocationNormalizedLoaded) => string),
      default: null,
    },
  },
  setup (props, { attrs, slots, expose }) {
    const nuxtApp = useNuxtApp()
    const pageRef = ref()
    const forkRoute = inject(PageRouteSymbol, null)
    let previousPageKey: string | undefined | false

    expose({ pageRef })

    const _layoutMeta = inject(LayoutMetaSymbol, null)
    let vnode: VNode

    const done = nuxtApp.deferHydration()
    if (import.meta.client && nuxtApp.isHydrating) {
      const removeErrorHook = nuxtApp.hooks.hookOnce('app:error', done)
      useRouter().beforeEach(removeErrorHook)
    }

    if (import.meta.client && props.pageKey) {
      watch(() => props.pageKey, (next, prev) => {
        if (next !== prev) {
          nuxtApp.callHook('page:loading:start')
        }
      })
    }

    if (import.meta.dev) {
      nuxtApp._isNuxtPageUsed = true
    }

    let pageLoadingEndHookAlreadyCalled = false
    if (import.meta.client) {
      const unsub = useRouter().beforeResolve(() => {
        pageLoadingEndHookAlreadyCalled = false
      })
      onBeforeUnmount(() => {
        unsub()
      })
    }

    return () => {
      return h(RouterView, { name: props.name, route: props.route, ...attrs }, {
        default: import.meta.server
          ? (routeProps: RouterViewSlotProps) => {
              return h(Suspense, { suspensible: true }, {
                default () {
                  return h(RouteProvider, {
                    vnode: slots.default ? normalizeSlot(slots.default, routeProps) : routeProps.Component,
                    route: routeProps.route,
                    vnodeRef: pageRef,
                  })
                },
              })
            }
          : (routeProps: RouterViewSlotProps) => {
              const isRenderingNewRouteInOldFork = haveParentRoutesRendered(forkRoute, routeProps.route, routeProps.Component)
              const hasSameChildren = forkRoute && forkRoute.matched.length === routeProps.route.matched.length

              if (!routeProps.Component) {
              // If we're rendering a `<NuxtPage>` child route on navigation to a route which lacks a child page
              // we'll render the old vnode until the new route finishes resolving
                if (vnode && !hasSameChildren) {
                  return vnode
                }
                done()
                return
              }

              // Return old vnode if we are rendering _new_ page suspense fork in _old_ layout suspense fork
              if (vnode && _layoutMeta && !_layoutMeta.isCurrent(routeProps.route)) {
                return vnode
              }

              if (isRenderingNewRouteInOldFork && forkRoute && (!_layoutMeta || _layoutMeta?.isCurrent(forkRoute))) {
              // if leaving a route with an existing child route, render the old vnode
                if (hasSameChildren) {
                  return vnode
                }
                // If _leaving_ null child route, return null vnode
                return null
              }

              const key = generateRouteKey(routeProps, props.pageKey)

              const willRenderAnotherChild = hasChildrenRoutes(forkRoute, routeProps.route, routeProps.Component)
              if (!nuxtApp.isHydrating && previousPageKey === key && !willRenderAnotherChild) {
                nextTick(() => {
                  pageLoadingEndHookAlreadyCalled = true
                  nuxtApp.callHook('page:loading:end')
                })
              }

              previousPageKey = key

              const hasTransition = !!(props.transition ?? routeProps.route.meta.pageTransition ?? defaultPageTransition)
              const transitionProps = hasTransition && _mergeTransitionProps([
                props.transition,
                routeProps.route.meta.pageTransition,
                defaultPageTransition,
                {
                  onBeforeLeave () {
                    nuxtApp._runningTransition = true
                  },
                  onAfterLeave () {
                    delete nuxtApp._runningTransition
                    nuxtApp.callHook('page:transition:finish', routeProps.Component)
                  },
                },
              ])

              const keepaliveConfig = props.keepalive ?? routeProps.route.meta.keepalive ?? (defaultKeepaliveConfig as KeepAliveProps)
              vnode = _wrapInTransition(hasTransition && transitionProps,
                wrapInKeepAlive(keepaliveConfig, h(Suspense, {
                  suspensible: true,
                  onPending: () => nuxtApp.callHook('page:start', routeProps.Component),
                  onResolve: () => {
                    nextTick(() => nuxtApp.callHook('page:finish', routeProps.Component).then(() => {
                      if (!pageLoadingEndHookAlreadyCalled && !willRenderAnotherChild) {
                        pageLoadingEndHookAlreadyCalled = true
                        return nuxtApp.callHook('page:loading:end')
                      }
                    }).finally(done))
                  },
                }, {
                  default: () => {
                    const routeProviderProps = {
                      key: key || undefined,
                      vnode: slots.default ? normalizeSlot(slots.default, routeProps) : routeProps.Component,
                      route: routeProps.route,
                      renderKey: key || undefined,
                      trackRootNodes: hasTransition,
                      vnodeRef: pageRef,
                    }

                    if (!keepaliveConfig) {
                      return h(RouteProvider, routeProviderProps)
                    }

                    const routerComponentType = routeProps.Component.type as any
                    const routeProviderKey = import.meta.dev ? routerComponentType.name || routerComponentType.__name : routerComponentType
                    let PageRouteProvider = _routeProviders.get(routeProviderKey)

                    if (!PageRouteProvider) {
                      PageRouteProvider = defineRouteProvider(routerComponentType.name || routerComponentType.__name)
                      _routeProviders.set(routeProviderKey, PageRouteProvider)
                    }

                    return h(PageRouteProvider, routeProviderProps)
                  },
                }),
                )).default()

              return vnode
            },
      })
    }
  },
}) as unknown as {
  new(): {
    $props: AllowedComponentProps &
      ComponentCustomProps &
      VNodeProps &
      NuxtPageProps

    $slots: {
      default?: (routeProps: RouterViewSlotProps) => VNode[]
    }

    // expose
    /**
     * Reference to the page component instance
     */
    pageRef: Element | ComponentPublicInstance | null
  }
}

function _mergeTransitionProps (routeProps: TransitionProps[]): TransitionProps {
  const _props: TransitionProps[] = routeProps.filter(Boolean).map(prop => ({
    ...prop,
    onAfterLeave: prop.onAfterLeave ? toArray(prop.onAfterLeave) : undefined,
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
  return index < newRoute.matched.length - 1
}

function normalizeSlot (slot: Slot, data: RouterViewSlotProps) {
  const slotContent = slot(data)
  return slotContent.length === 1 ? h(slotContent[0]!) : h(Fragment, undefined, slotContent)
}
