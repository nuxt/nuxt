import type { Ref, VNode, VNodeRef } from 'vue'
import { Suspense, Transition, computed, defineComponent, h, inject, mergeProps, nextTick, onMounted, ref, unref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { _wrapIf } from './utils'
import { useRoute } from '#app/composables/router'
// @ts-expect-error virtual file
import { useRoute as useVueRouterRoute } from '#build/pages'
// @ts-expect-error virtual file
import layouts from '#build/layouts'
// @ts-expect-error virtual file
import { appLayoutTransition as defaultLayoutTransition } from '#build/nuxt.config.mjs'
import { useNuxtApp } from '#app'

export default defineComponent({
  name: 'NuxtLayout',
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean, Object] as unknown as () => string | false | Ref<string | false>,
      default: null
    }
  },
  setup (props, context) {
    const nuxtApp = useNuxtApp()
    // Need to ensure (if we are not a child of `<NuxtPage>`) that we use synchronous route (not deferred)
    const injectedRoute = inject('_route') as RouteLocationNormalizedLoaded
    const route = injectedRoute === useRoute() ? useVueRouterRoute() : injectedRoute
    const layout = computed(() => unref(props.name) ?? route.meta.layout as string ?? 'default')

    const layoutRef = ref()
    context.expose({ layoutRef })

    let vnode: VNode
    let _layout: string | false
    if (process.dev && process.client) {
      onMounted(() => {
        nextTick(() => {
          if (_layout && _layout in layouts && ['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            console.warn(`[nuxt] \`${_layout}\` layout does not have a single root node and will cause errors when navigating between routes.`)
          }
        })
      })
    }

    return () => {
      const done = nuxtApp.deferHydration()
      const hasLayout = layout.value && layout.value in layouts
      if (process.dev && layout.value && !hasLayout && layout.value !== 'default') {
        console.warn(`Invalid layout \`${layout.value}\` selected.`)
      }

      const transitionProps = route.meta.layoutTransition ?? defaultLayoutTransition

      if (process.dev && process.client && hasLayout && transitionProps) {
        _layout = layout.value
        vnode = _wrapIf(Transition, hasLayout && transitionProps, {
          default: () => h(Suspense, { suspensible: true, onResolve: () => { nextTick(done) } }, {
            default: () => _wrapIf(layouts[layout.value], hasLayout && mergeProps(context.attrs, { ref: layoutRef }), context.slots).default()
          })
        }).default()

        return vnode
      }

      // We avoid rendering layout transition if there is no layout to render
      return _wrapIf(Transition, hasLayout && transitionProps, {
        default: () => h(Suspense, { suspensible: true, onResolve: () => { nextTick(done) } }, {
          default: () => _wrapIf(layouts[layout.value], hasLayout && mergeProps(context.attrs, { ref: layoutRef }), context.slots).default()
        })
      }).default()
    }
  }
})
