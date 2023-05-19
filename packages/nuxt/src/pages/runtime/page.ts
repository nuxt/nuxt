import { Suspense, Transition, computed, defineComponent, getCurrentInstance, h, markRaw, nextTick, onMounted, provide, reactive } from 'vue'
import type { KeepAliveProps, TransitionProps, VNode } from 'vue'
import { RouterView } from '#vue-router'
import { defu } from 'defu'
import type { RouteLocation, RouteLocationNormalized, RouteLocationNormalizedLoaded } from '#vue-router'

import type { RouterViewSlotProps } from './utils'
import { generateRouteKey, wrapInKeepAlive } from './utils'
import { useNuxtApp } from '#app/nuxt'
import { _wrapIf } from '#app/components/utils'
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

    let vnode: VNode | null = null
    const exposed = markRaw({}) as Record<string, any>
    expose(exposed)
    const instance = getCurrentInstance()!

    return () => {
      return h(RouterView, { name: props.name, route: props.route, ...attrs }, {
        default: (routeProps: RouterViewSlotProps) => {
          if (!routeProps.Component) { return }

          if (process.client) {
            // expose the exposed route components data to the exposed object
            nextTick(async () => {
              // await a second tick for the route component's tick
              await nextTick()
              Object.keys(exposed).forEach(key => delete exposed[key])
              if (vnode && vnode.component && vnode.component.exposed) {
                Object.assign(exposed, vnode.component.exposed)
              }
              instance.parent?.update()
            })
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

          return _wrapIf(Transition, hasTransition && transitionProps,
            wrapInKeepAlive(props.keepalive ?? routeProps.route.meta.keepalive ?? (defaultKeepaliveConfig as KeepAliveProps), h(Suspense, {
              suspensible: true,
              onPending: () => nuxtApp.callHook('page:start', routeProps.Component),
              onResolve: () => { nextTick(() => nuxtApp.callHook('page:finish', routeProps.Component).finally(done)) }
            }, {
              default: () => {
                vnode = h(RouteProvider, { key, routeProps, pageKey: key, hasTransition } as {})
                return vnode
              }
            })
            )).default()
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
  props: ['routeProps', 'pageKey', 'hasTransition'],
  setup (props, { expose }) {
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

    let vnode: VNode | undefined

    const exposed = markRaw({}) as Record<string, any>

    expose(exposed)

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
      vnode = h(props.routeProps.Component)

      if (process.client) {
        nextTick(() => {
          Object.keys(exposed).forEach(key => delete exposed[key])
          if (vnode && vnode.component && vnode.component.exposed) {
            Object.assign(exposed, vnode.component.exposed)
          }
        })
      }
      return vnode
    }
  }
})
