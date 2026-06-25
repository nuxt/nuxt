import { Fragment, Suspense, createCommentVNode, defineComponent, h, inject, isVNode, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AllowedComponentProps, Component, ComponentCustomProps, ComponentPublicInstance, KeepAliveProps, Slot, TransitionProps, VNode, VNodeProps } from 'vue'
import { RouterView } from 'vue-router'
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded, RouterViewProps } from 'vue-router'

import { generateRouteKey, wrapInKeepAlive } from './utils'
import type { RouterViewSlotProps } from './utils'
import { RouteProvider, defineRouteProvider } from '#app/components/route-provider'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { _mergeTransitionProps, _wrapInTransition } from '#app/components/utils'
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
    const keepAliveInclude = new Set<string>()

    let previousPageKey: string | undefined | false

    expose({ pageRef })

    const _layoutMeta = inject(LayoutMetaSymbol, null)
    let vnode: VNode | undefined

    const done = nuxtApp.deferHydration()
    let isSuspensePending = false
    let hasResolvedOnce = false
    let pageStartPromise: ReturnType<typeof nuxtApp.callHook>

    let suspenseKey = 0
    if (import.meta.client && nuxtApp.isHydrating) {
      const removeErrorHook = nuxtApp.hooks.hookOnce('app:error', done)
      const removeGuard = useRouter().beforeEach(() => {
        removeErrorHook()
        removeGuard()
      })
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
        // Ensure hydration completes if unmounted before Suspense resolves (e.g., layout change)
        done()
      })
    }

    return () => {
      return h(RouterView, { name: props.name, route: props.route, ...attrs }, {
        default: markStableSlot(import.meta.server
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
                if (vnode && !hasSameChildren && !isStaleVNode(vnode)) {
                  return vnode
                }
                done()
                return
              }

              // Return old vnode if we are rendering _new_ page suspense fork in _old_ layout suspense fork
              if (vnode && _layoutMeta && !isStaleVNode(vnode) && !_layoutMeta.isCurrent(routeProps.route)) {
                return vnode
              }

              if (isRenderingNewRouteInOldFork && forkRoute && (!_layoutMeta || _layoutMeta?.isCurrent(forkRoute))) {
              // if leaving a route with an existing child route, render the old vnode
                if ((hasSameChildren || vnode) && !isStaleVNode(vnode)) {
                  return vnode
                }
                // If _leaving_ null child route, return null vnode
                return null
              }

              const key = generateRouteKey(routeProps, props.pageKey)

              const willRenderAnotherChild = hasChildrenRoutes(forkRoute, routeProps.route, routeProps.Component)
              if (!nuxtApp.isHydrating && previousPageKey === key && !willRenderAnotherChild) {
                nextTick(() => {
                  if (!pageLoadingEndHookAlreadyCalled) {
                    pageLoadingEndHookAlreadyCalled = true
                    nuxtApp.callHook('page:loading:end')
                  }
                })
              }

              // remount suspense on rapid navigation, but not before the first resolve:
              // tearing down a never-resolved suspensible Suspense strands its parent. See #28425, #34683.
              if (isSuspensePending && previousPageKey !== key && hasResolvedOnce) {
                suspenseKey++
              }

              previousPageKey = key

              const hasTransition = !!(props.transition ?? routeProps.route.meta.pageTransition ?? defaultPageTransition)
              const transitionProps = hasTransition && _mergeTransitionProps([
                props.transition,
                routeProps.route.meta.pageTransition,
                defaultPageTransition,
                {
                  onAfterLeave () {
                    nuxtApp['~transitionFinish']?.()
                    delete nuxtApp['~transitionFinish']
                    delete nuxtApp['~transitionPromise']
                    nuxtApp.callHook('page:transition:finish', routeProps.Component)
                  },
                },
              ])

              const routeKeepaliveConfig = props.keepalive ?? routeProps.route.meta.keepalive ?? (defaultKeepaliveConfig as boolean | KeepAliveProps)

              const routerComponentType = routeProps.Component.type as any
              const componentName = routerComponentType.name || routerComponentType.__name

              if (routeProps.route.meta.keepalive && componentName) {
                keepAliveInclude.add(componentName)
              }

              // Pages that opt into keepalive via `definePageMeta` should stay cached when navigating to
              // pages that don't (#33610). We accumulate their component names in `keepAliveInclude` and
              // inject it into the effective `<KeepAlive>` config so the wrapper stays present across
              // navigations and Vue's cache is preserved.
              let keepaliveConfig: boolean | KeepAliveProps

              const shouldAugmentInclude =
                keepAliveInclude.size > 0 &&
                props.keepalive == null &&
                (
                  !routeKeepaliveConfig ||
                  (typeof routeKeepaliveConfig === 'object' && routeKeepaliveConfig && routeKeepaliveConfig.include)
                )

              if (shouldAugmentInclude) {
                const baseConfig = typeof routeKeepaliveConfig === 'object' && routeKeepaliveConfig
                  ? { ...routeKeepaliveConfig }
                  : {}

                const existingInclude = baseConfig.include
                  ? Array.isArray(baseConfig.include)
                    ? baseConfig.include
                    : [baseConfig.include]
                  : []

                keepaliveConfig = { ...baseConfig, include: Array.from(new Set([...existingInclude, ...keepAliveInclude])) }
              } else {
                keepaliveConfig = routeKeepaliveConfig
              }

              vnode = _wrapInTransition(hasTransition && transitionProps,
                wrapInKeepAlive(keepaliveConfig, h(Suspense, {
                  key: suspenseKey,
                  suspensible: true,
                  onPending: () => {
                    isSuspensePending = true
                    if (hasTransition && !nuxtApp['~transitionPromise']) {
                      nuxtApp['~transitionPromise'] = new Promise((resolve) => {
                        nuxtApp['~transitionFinish'] = resolve
                      })
                    }
                    pageStartPromise = nuxtApp.callHook('page:start', routeProps.Component)
                  },
                  onResolve: async () => {
                    isSuspensePending = false
                    hasResolvedOnce = true
                    // Restore the real route (kept query-less for the hydration render) before the
                    // page's mounted hooks flush, so its query is present in `onMounted`.
                    if (import.meta.client && nuxtApp.isHydrating) {
                      nuxtApp['~restoreDeferredRoute']?.()
                    }
                    try {
                      await nextTick()
                      nuxtApp._route.sync?.()
                      await pageStartPromise
                      await nuxtApp.callHook('page:finish', routeProps.Component)
                      if (!pageLoadingEndHookAlreadyCalled && !willRenderAnotherChild) {
                        pageLoadingEndHookAlreadyCalled = true
                        await nuxtApp.callHook('page:loading:end')
                      }
                    } finally {
                      done()
                    }
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

                    const routeProviderKey = import.meta.dev ? componentName : routerComponentType
                    let PageRouteProvider = _routeProviders.get(routeProviderKey)

                    if (!PageRouteProvider) {
                      PageRouteProvider = defineRouteProvider(componentName)
                      _routeProviders.set(routeProviderKey, PageRouteProvider)
                    }

                    return h(PageRouteProvider, routeProviderProps)
                  },
                }),
                )).default()

              return vnode
            }),
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

function haveParentRoutesRendered (fork: RouteLocationNormalizedLoaded | null, newRoute: RouteLocationNormalizedLoaded, Component?: VNode) {
  if (!fork) { return false }

  const index = newRoute.matched.findIndex(m => m.components?.default === Component?.type)
  if (index === -1) { return false }

  // Parent routes without a component are transparent — Vue Router renders the child directly
  // at the parent's depth (see #34967), so they don't contribute a "parent render" above us.
  const newParents = newRoute.matched.slice(0, index).filter(m => m.components?.default)
  if (!newParents.length) { return false }
  const forkParents = fork.matched.filter(m => m.components?.default)

  // we only care whether the parent route components have had to rerender
  return newParents.some((c, i) => c.components?.default !== forkParents[i]?.components?.default) ||
    (Component && generateRouteKey({ route: newRoute, Component }) !== generateRouteKey({ route: fork, Component }))
}

function hasChildrenRoutes (fork: RouteLocationNormalizedLoaded | null, newRoute: RouteLocationNormalizedLoaded, Component?: VNode) {
  if (!fork) { return false }

  const index = newRoute.matched.findIndex(m => m.components?.default === Component?.type)
  return index < newRoute.matched.length - 1
}

// Flag the slot as precompiled (`_n`) so Vue skips its slot wrapper, which is what emits the
// dev-only "slot invoked outside render" warning. The warning otherwise misfires when a page
// using top-level `await` (e.g. `navigateTo()`) re-renders before Vue's `withAsyncContext`
// cleanup clears `currentInstance`. We replicate Vue's array coercion here so vue-router's
// `slotContent.length` path still works. See #34683.
function markStableSlot<T extends (routeProps: RouterViewSlotProps) => VNode | VNode[] | null | undefined> (fn: T): T {
  const wrapped = ((routeProps: RouterViewSlotProps) => {
    const result = fn(routeProps)
    if (Array.isArray(result)) { return result }
    if (result == null || !isVNode(result)) { return [createCommentVNode()] }
    return [result]
  }) as unknown as T
  ;(wrapped as any)._n = true
  return wrapped
}

function normalizeSlot (slot: Slot, data: RouterViewSlotProps) {
  const slotContent = slot(data)
  return slotContent.length === 1 ? h(slotContent[0]!) : h(Fragment, undefined, slotContent)
}

// A previously-stored Suspense vnode whose boundary has already been unmounted carries a stale
// `el` reference; returning it would put Vue on the hydration code path during a fresh mount and
// throw `Cannot read properties of null (reading 'nodeType' / 'exposed')`. See nuxt/nuxt#23232.
function isStaleVNode (vnode: VNode | undefined): boolean {
  return !!vnode && (!!vnode.suspense?.isUnmounted || !!vnode.component?.isUnmounted)
}
