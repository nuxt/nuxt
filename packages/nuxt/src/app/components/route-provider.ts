import { defineComponent, h, nextTick, onMounted, onUnmounted, provide, shallowReactive } from 'vue'
import type { DefineSetupFnComponent, Ref, VNode } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router'
import { renderDiagnostics } from '../diagnostics/render'
import { trackRenderedRecord } from '../diagnostics/rendered-records'
import { PageRouteSymbol } from './injections'

interface RouteProviderProps {
  route: RouteLocationNormalizedLoaded
  vnode?: VNode
  vnodeRef?: Ref<any>
  renderKey?: string
  trackRootNodes?: boolean
  /** the matched route record this provider renders, used by dev-only render diagnostics */
  routeRecord?: RouteRecordNormalized
}

export type RouteProviderComponent = DefineSetupFnComponent<RouteProviderProps>

export const defineRouteProvider = (name = 'RouteProvider'): RouteProviderComponent => defineComponent({
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
    routeRecord: Object as () => RouteRecordNormalized,
  },
  setup (props) {
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
      const record = props.routeRecord ?? props.route.matched.find(m => m.components?.default === props.vnode?.type)
      if (record) {
        onUnmounted(trackRenderedRecord(record))
      }
    }

    let vnode: VNode
    if (import.meta.dev && import.meta.client && props.trackRootNodes) {
      onMounted(() => {
        nextTick(() => {
          if (['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            const filename = (vnode?.type as any)?.__file
            renderDiagnostics.NUXT_E4004({ filename })
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
}) as unknown as RouteProviderComponent

export const RouteProvider: RouteProviderComponent = defineRouteProvider()
