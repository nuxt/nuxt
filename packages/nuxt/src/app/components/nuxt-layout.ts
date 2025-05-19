import type { DefineComponent, ExtractPublicPropTypes, MaybeRef, PropType, VNode } from 'vue'
import { Suspense, computed, defineComponent, h, inject, mergeProps, nextTick, onMounted, provide, shallowReactive, shallowRef, unref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import type { PageMeta } from '../../pages/runtime/composables'

import { useRoute, useRouter } from '../composables/router'
import { useNuxtApp } from '../nuxt'
import { _wrapInTransition } from './utils'
import { LayoutMetaSymbol, PageRouteSymbol } from './injections'

// @ts-expect-error virtual file
import { useRoute as useVueRouterRoute } from '#build/pages'
// @ts-expect-error virtual file
import layouts from '#build/layouts'
// @ts-expect-error virtual file
import { appLayoutTransition as defaultLayoutTransition } from '#build/nuxt.config.mjs'

const LayoutLoader = defineComponent({
  name: 'LayoutLoader',
  inheritAttrs: false,
  props: {
    name: String,
    layoutProps: Object,
  },
  setup (props, context) {
    // This is a deliberate hack - this component must always be called with an explicit key to ensure
    // that setup reruns when the name changes.
    return () => h(layouts[props.name], props.layoutProps, context.slots)
  },
})

// props are moved outside of defineComponent to later explicitly assert the prop types
// this avoids type loss/simplification resulting in things like MaybeRef<string | false>, keeping type hints for layout names
const nuxtLayoutProps = {
  name: {
    type: [String, Boolean, Object] as PropType<unknown extends PageMeta['layout'] ? MaybeRef<string | false> : PageMeta['layout']>,
    default: null,
  },
  fallback: {
    type: [String, Object] as PropType<unknown extends PageMeta['layout'] ? MaybeRef<string> : PageMeta['layout']>,
    default: null,
  },
}

export default defineComponent({
  name: 'NuxtLayout',
  inheritAttrs: false,
  props: nuxtLayoutProps,
  setup (props, context) {
    const nuxtApp = useNuxtApp()
    // Need to ensure (if we are not a child of `<NuxtPage>`) that we use synchronous route (not deferred)
    const injectedRoute = inject(PageRouteSymbol)
    const shouldUseEagerRoute = !injectedRoute /* this should never be true */
      || injectedRoute === useRoute() /* this is only true if we are not within `<NuxtPage>` */
    const route = shouldUseEagerRoute ? useVueRouterRoute() as ReturnType<typeof useRoute> : injectedRoute

    const layout = computed(() => {
      let layout = unref(props.name) ?? route?.meta.layout as string ?? 'default'
      if (layout && !(layout in layouts)) {
        if (import.meta.dev && layout !== 'default') {
          console.warn(`Invalid layout \`${layout}\` selected.`)
        }
        if (props.fallback) {
          layout = unref(props.fallback)
        }
      }
      return layout
    })

    const layoutRef = shallowRef()
    context.expose({ layoutRef })

    const done = nuxtApp.deferHydration()
    if (import.meta.client && nuxtApp.isHydrating) {
      const removeErrorHook = nuxtApp.hooks.hookOnce('app:error', done)
      useRouter().beforeEach(removeErrorHook)
    }

    if (import.meta.dev) {
      nuxtApp._isNuxtLayoutUsed = true
    }

    let lastLayout: string | boolean | undefined

    return () => {
      const hasLayout = layout.value && layout.value in layouts
      const transitionProps = route?.meta.layoutTransition ?? defaultLayoutTransition

      const previouslyRenderedLayout = lastLayout
      lastLayout = layout.value

      // We avoid rendering layout transition if there is no layout to render
      return _wrapInTransition(hasLayout && transitionProps, {
        default: () => h(Suspense, { suspensible: true, onResolve: () => { nextTick(done) } }, {
          default: () => h(
            LayoutProvider,
            {
              layoutProps: mergeProps(context.attrs, { ref: layoutRef }),
              key: layout.value || undefined,
              name: layout.value,
              shouldProvide: !props.name,
              isRenderingNewLayout: (name?: string | boolean) => {
                return (name !== previouslyRenderedLayout && name === layout.value)
              },
              hasTransition: !!transitionProps,
            }, context.slots),
        }),
      }).default()
    }
  },
}) as DefineComponent<ExtractPublicPropTypes<typeof nuxtLayoutProps>>

const LayoutProvider = defineComponent({
  name: 'NuxtLayoutProvider',
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean] as unknown as () => string | false,
    },
    layoutProps: {
      type: Object,
    },
    hasTransition: {
      type: Boolean,
    },
    shouldProvide: {
      type: Boolean,
    },
    isRenderingNewLayout: {
      type: Function as unknown as () => (name?: string | boolean) => boolean,
      required: true,
    },
  },
  setup (props, context) {
    // Prevent reactivity when the page will be rerendered in a different suspense fork

    const name = props.name
    if (props.shouldProvide) {
      provide(LayoutMetaSymbol, {
        isCurrent: (route: RouteLocationNormalizedLoaded) => name === (route.meta.layout ?? 'default'),
      })
    }

    // this route waits to update until the page has finished changing
    const injectedRoute = inject(PageRouteSymbol)
    const isNotWithinNuxtPage = injectedRoute && injectedRoute === useRoute()

    if (isNotWithinNuxtPage) {
      // this route updates immediately
      const vueRouterRoute = useVueRouterRoute() as ReturnType<typeof useRoute>
      const reactiveChildRoute = {} as RouteLocationNormalizedLoaded
      for (const _key in vueRouterRoute) {
        const key = _key as keyof RouteLocationNormalizedLoaded
        Object.defineProperty(reactiveChildRoute, key, {
          enumerable: true,
          get: () => {
            // we want to use the eager route if we are rendering a layout for the first time
            // and only swap back to the lazy route if the route has already changed from the first render
            return props.isRenderingNewLayout(props.name) ? vueRouterRoute[key] : injectedRoute[key]
          },
        })
      }
      provide(PageRouteSymbol, shallowReactive(reactiveChildRoute))
    }

    let vnode: VNode | undefined
    if (import.meta.dev && import.meta.client) {
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
        if (import.meta.dev && import.meta.client && props.hasTransition) {
          vnode = context.slots.default?.() as VNode | undefined
          return vnode
        }
        return context.slots.default?.()
      }

      if (import.meta.dev && import.meta.client && props.hasTransition) {
        vnode = h(
          LayoutLoader,
          { key: name, layoutProps: props.layoutProps, name },
          context.slots,
        )

        return vnode
      }

      return h(
        LayoutLoader,
        { key: name, layoutProps: props.layoutProps, name },
        context.slots,
      )
    }
  },
})
