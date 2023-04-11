import type { Ref, VNode } from 'vue'
import { Transition, computed, defineComponent, h, inject, nextTick, onMounted, unref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { _wrapIf } from './utils'
import { useRoute } from '#app/composables/router'
// @ts-ignore
import { useRoute as useVueRouterRoute } from '#build/pages'
// @ts-ignore
import layouts from '#build/layouts'
// @ts-ignore
import { appLayoutTransition as defaultLayoutTransition } from '#build/nuxt.config.mjs'

// TODO: revert back to defineAsyncComponent when https://github.com/vuejs/core/issues/6638 is resolved
const LayoutLoader = defineComponent({
  name: 'LayoutLoader',
  inheritAttrs: false,
  props: {
    name: String,
    ...process.dev ? { hasTransition: Boolean } : {}
  },
  async setup (props, context) {
    let vnode: VNode

    if (process.dev && process.client) {
      onMounted(() => {
        nextTick(() => {
          if (props.name && ['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            console.warn(`[nuxt] \`${props.name}\` layout does not have a single root node and will cause errors when navigating between routes.`)
          }
        })
      })
    }

    const LayoutComponent = await layouts[props.name]().then((r: any) => r.default || r)

    return () => {
      if (process.dev && process.client && props.hasTransition) {
        vnode = h(LayoutComponent, context.attrs, context.slots)
        return vnode
      }
      return h(LayoutComponent, context.attrs, context.slots)
    }
  }
})
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
    // Need to ensure (if we are not a child of `<NuxtPage>`) that we use synchronous route (not deferred)
    const injectedRoute = inject('_route') as RouteLocationNormalizedLoaded
    const route = injectedRoute === useRoute() ? useVueRouterRoute() : injectedRoute
    const layout = computed(() => {
      const layoutName = unref(props.name) ?? route.meta.layout as string ?? 'default'

      if (typeof layoutName === 'string') {
        const layoutPath = layoutName.replace(/-/g, '/')

        // Check if layout exists for example `desktop-default` will translate to `layouts/desktop/default`
        if (layoutPath in layouts) {
          return layoutPath
        }

        // Check if layout exists for example `desktop` or `desktop-index` will translate to ` `layouts/desktop/index`
        if ((layoutPath + '/index') in layouts) {
          return layoutPath + '/index'
        }

        // If the directory inside layouts has has a dash in the name such as `desktop-base` we need to check for that
        if (layoutName.includes('-')) {
          const layoutPath = layoutName.replace(/-/g, '/')

          // Check if layout exists for example `desktop-base`  will translate to `layouts/desktop/base`
          if (layoutPath in layouts) {
            return layoutPath
          }

          // Check if layout exists for example `desktop-base` will translate to `layouts/desktop-base/base`
          const layoutPathLast = layoutName.split('-').pop()
          if (layoutName + '/' + layoutPathLast in layouts) {
            return layoutName + '/' + layoutPathLast
          }

          // Check if layout exists for example `desktop-base` will translate to `layouts/desktop-base/index`
          if (layoutName + '/index' in layouts) {
            return layoutName + '/index'
          }
        }
      }

      return layoutName
    })

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
      const hasLayout = layout.value && layout.value in layouts
      if (process.dev && layout.value && !hasLayout && layout.value !== 'default') {
        console.warn(`Invalid layout \`${layout.value}\` selected.`)
      }

      const transitionProps = route.meta.layoutTransition ?? defaultLayoutTransition

      // We avoid rendering layout transition if there is no layout to render
      return _wrapIf(Transition, hasLayout && transitionProps, {
        default: () => _wrapIf(LayoutLoader, hasLayout && {
          key: layout.value,
          name: layout.value,
          ...(process.dev ? { hasTransition: !!transitionProps } : {}),
          ...context.attrs
        }, context.slots).default()
      }).default()
    }
  }
})
