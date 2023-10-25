import type { DefineComponent, MaybeRef, VNode } from 'vue'
import { Suspense, Transition, computed, defineComponent, h, inject, mergeProps, nextTick, onMounted, provide, ref, unref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { _wrapIf } from './utils'
import { LayoutMetaSymbol, PageRouteSymbol } from './injections'
import type { PageMeta } from '#app'

import { useRoute } from '#app/composables/router'
import { useNuxtApp } from '#app/nuxt'
// @ts-expect-error virtual file
import { useRoute as useVueRouterRoute } from '#build/pages'
// @ts-expect-error virtual file
import layouts from '#build/layouts'
// @ts-expect-error virtual file
import { appLayoutTransition as defaultLayoutTransition } from '#build/nuxt.config.mjs'

// TODO: revert back to defineAsyncComponent when https://github.com/vuejs/core/issues/6638 is resolved
const LayoutLoader = defineComponent({
  name: 'LayoutLoader',
  inheritAttrs: false,
  props: {
    name: String,
    layoutProps: Object
  },
  async setup (props, context) {
    // This is a deliberate hack - this component must always be called with an explicit key to ensure
    // that setup reruns when the name changes.

    const LayoutComponent = await layouts[props.name]().then((r: any) => r.default || r)

    return () => h(LayoutComponent, props.layoutProps, context.slots)
  }
})

export default defineComponent({
  name: 'NuxtLayout',
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean, Object] as unknown as () => unknown extends PageMeta['layout'] ? MaybeRef<string | false> : PageMeta['layout'],
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
      if (import.meta.dev && layout.value && !hasLayout && layout.value !== 'default') {
        console.warn(`Invalid layout \`${layout.value}\` selected.`)
      }

      const transitionProps = route.meta.layoutTransition ?? defaultLayoutTransition

      // We avoid rendering layout transition if there is no layout to render
      return _wrapIf(Transition, hasLayout && transitionProps, {
        default: () => h(Suspense, { suspensible: true, onResolve: () => { nextTick(done) } }, {
          default: () => h(
            LayoutProvider,
            {
              layoutProps: mergeProps(context.attrs, { ref: layoutRef }),
              key: layout.value || undefined,
              name: layout.value,
              shouldProvide: !props.name,
              hasTransition: !!transitionProps
            }, context.slots)
        })
      }).default()
    }
  }
}) as unknown as DefineComponent<{
  name?: (unknown extends PageMeta['layout'] ? MaybeRef<string | false> : PageMeta['layout']) | undefined;
}>

const LayoutProvider = defineComponent({
  name: 'NuxtLayoutProvider',
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean] as unknown as () => string | false
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

    const name = props.name
    if (props.shouldProvide) {
      provide(LayoutMetaSymbol, {
        isCurrent: (route: RouteLocationNormalizedLoaded) => name === (route.meta.layout ?? 'default')
      })
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
          context.slots
        )

        return vnode
      }

      return h(
        LayoutLoader,
        { key: name, layoutProps: props.layoutProps, name },
        context.slots
      )
    }
  }
})
