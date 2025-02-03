import { defineComponent, nextTick, onMounted, provide, shallowReactive } from 'vue'
import type { VNode } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { PageRouteSymbol } from './injections'

export const defineRouteProvider = (name = 'RouteProvider') => defineComponent({
  name,
  props: {
    vnode: {
      type: Object as () => VNode,
      required: true,
    },
    route: {
      type: Object as () => RouteLocationNormalizedLoaded,
      required: true,
    },
    renderKey: String,
  },
  setup (props, context) {
    // Prevent reactivity when the page will be rerendered in a different suspense fork
    const previousKey = props.renderKey
    const previousRoute = props.route

    // Provide a reactive route within the page
    const route = {} as RouteLocationNormalizedLoaded
    for (const key in props.route) {
      Object.defineProperty(route, key, {
        get: () => previousKey === props.renderKey ? props.route[key as keyof RouteLocationNormalizedLoaded] : previousRoute[key as keyof RouteLocationNormalizedLoaded],
        enumerable: true,
      })
    }

    provide(PageRouteSymbol, shallowReactive(route))

    if (import.meta.dev && import.meta.client) {
      onMounted(() => {
        if (props.vnode.transition) {
          nextTick(() => {
            if (['#comment', '#text'].includes(props.vnode?.el?.nodeName)) {
              const filename = (props.vnode?.type as any).__file
              console.warn(`[nuxt] \`${filename}\` does not have a single root node and will cause errors when navigating between routes.`)
            }
          })
        }
      })
    }

    return () => context.slots.default?.()
  },
})
