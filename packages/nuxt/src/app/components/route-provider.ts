import { defineComponent, h, nextTick, onMounted, provide, shallowReactive, shallowRef, watch } from 'vue'
import type { Ref, VNode } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { PageRouteSymbol } from './injections'
import { useRouter } from '#app/composables/router'
import { useNuxtApp } from '#app/nuxt'

export const defineRouteProvider = (name = 'RouteProvider') => defineComponent({
  name,
  props: {
    route: {
      type: Object as () => RouteLocationNormalizedLoaded,
      required: true,
    },
    vnode: Object as () => VNode,
    vnodeRef: Object as () => Ref<any>,
    renderKey: String,
    trackRootNodes: Boolean,
  },
  setup (props) {
    // Prevent reactivity when the page will be rerendered in a different suspense fork
    const previousKey = props.renderKey
    const previousRoute = props.route
    const routeVersion = shallowRef(0)

    // Provide a reactive route within the page
    const route = {} as RouteLocationNormalizedLoaded
    for (const key in props.route) {
      Object.defineProperty(route, key, {
        get: () => {
          routeVersion.value
          return previousKey === props.renderKey ? props.route[key as keyof RouteLocationNormalizedLoaded] : previousRoute[key as keyof RouteLocationNormalizedLoaded]
        },
        enumerable: true,
      })
    }

    provide(PageRouteSymbol, shallowReactive(route))

    // Force getter re-evaluation to sync query params during hydration
    if (import.meta.client) {
      const nuxtApp = useNuxtApp()
      const router = useRouter()

      if (nuxtApp.isHydrating) {
        const unwatch = watch(
          () => router.currentRoute.value,
          () => {
            routeVersion.value++
          },
          { flush: 'sync' },
        )
        nuxtApp.hooks.hookOnce('app:suspense:resolve', unwatch)
      }
    }

    let vnode: VNode
    if (import.meta.dev && import.meta.client && props.trackRootNodes) {
      onMounted(() => {
        nextTick(() => {
          if (['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            const filename = (vnode?.type as any)?.__file
            console.warn(`[nuxt] \`${filename}\` does not have a single root node and will cause errors when navigating between routes.`)
          }
        })
      })
    }

    return () => {
      if (!props.vnode) {
        return props.vnode
      }
      if (import.meta.dev && import.meta.client) {
        vnode = h(props.vnode, { ref: props.vnodeRef })
        return vnode
      }

      return h(props.vnode, { ref: props.vnodeRef })
    }
  },
})

export const RouteProvider = defineRouteProvider()
