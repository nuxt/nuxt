import type { Ref, VNode } from 'vue'
import { Suspense, Transition, computed, defineComponent, h, inject, mergeProps, nextTick, onMounted, provide, ref, unref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { _wrapIf } from './utils'
import { LayoutMetaSymbol, PageRouteSymbol } from './injections'

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
    const injectedRoute = inject(PageRouteSymbol)
    const route = injectedRoute === useRoute() ? useVueRouterRoute() : injectedRoute

    const layout = computed(() => unref(props.name) ?? route.meta.layout as string ?? 'default')

    const layoutRef = ref()
    context.expose({ layoutRef })

    const done = nuxtApp.deferHydration()

    return () => {
      const hasLayout = layout.value && layout.value in layouts
      if (process.dev && layout.value && !hasLayout && layout.value !== 'default') {
        console.warn(`Invalid layout \`${layout.value}\` selected.`)
      }

      const transitionProps = route.meta.layoutTransition ?? defaultLayoutTransition

      // We avoid rendering layout transition if there is no layout to render
      return _wrapIf(Transition, hasLayout && transitionProps, {
        default: () => h(Suspense, { suspensible: true, onResolve: () => { nextTick(done) } }, {
          // @ts-expect-error seems to be an issue in vue types
          default: () => h(LayoutProvider, {
            layoutProps: mergeProps(context.attrs, { ref: layoutRef }),
            key: layout.value,
            name: layout.value,
            shouldProvide: !props.name,
            hasTransition: !!transitionProps
          }, context.slots)
        })
      }).default()
    }
  }
})

const LayoutProvider = defineComponent({
  name: 'NuxtLayoutProvider',
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean]
    },
    layoutProps: {
      type: Object
    },
    hasTransition: {
      type: Boolean
    },
    shouldProvide: {
      type: Boolean
    }
  },
  setup (props, context) {
    // Prevent reactivity when the page will be rerendered in a different suspense fork
    // eslint-disable-next-line vue/no-setup-props-destructure
    const name = props.name
    if (props.shouldProvide) {
      provide(LayoutMetaSymbol, {
        isCurrent: (route: RouteLocationNormalizedLoaded) => name === (route.meta.layout ?? 'default')
      })
    }

    let vnode: VNode | undefined
    if (process.dev && process.client) {
      onMounted(() => {
        nextTick(() => {
          if (['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            if (name) {
              console.warn(`[nuxt] \`${name}\` layout does not have a single root node and will cause errors when navigating between routes.`)
            } else {
              console.warn('[nuxt] `<NuxtLayout>` needs to be passed a single root node in its default slot.')
            }
          }
        })
      })
    }

    return () => {
      if (!name || (typeof name === 'string' && !(name in layouts))) {
        if (process.dev && process.client && props.hasTransition) {
          vnode = context.slots.default?.() as VNode | undefined
          return vnode
        }
        return context.slots.default?.()
      }

      if (process.dev && process.client && props.hasTransition) {
        vnode = h(layouts[name], props.layoutProps, context.slots)

        return vnode
      }

      return h(layouts[name], props.layoutProps, context.slots)
    }
  }
})
