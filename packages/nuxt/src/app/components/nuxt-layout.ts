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
            // @ts-expect-error seems to be an issue in vue types
            LayoutProvider,
            {
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
}) as unknown as DefineComponent<{
  name?: (unknown extends PageMeta['layout'] ? MaybeRef<string | false> : PageMeta['layout']) | undefined;
}>

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
          // @ts-expect-error seems to be an issue in vue types
          LayoutLoader,
          { key: name, layoutProps: props.layoutProps, name },
          context.slots
        )

        return vnode
      }

      return h(
        // @ts-expect-error seems to be an issue in vue types
        LayoutLoader,
        { key: name, layoutProps: props.layoutProps, name },
        context.slots
      )
    }
  }
})
