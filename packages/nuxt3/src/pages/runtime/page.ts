import { defineComponent, h, Suspense, Transition } from 'vue'
import { RouteLocationNormalizedLoaded, RouterView } from 'vue-router'

import { generateRouteKey, RouterViewSlotProps, wrapIf, wrapInKeepAlive } from './utils'
import { useNuxtApp } from '#app'

export default defineComponent({
  name: 'NuxtPage',
  props: {
    pageKey: {
      type: [Function, String] as unknown as () => string | ((route: RouteLocationNormalizedLoaded) => string),
      default: null
    }
  },
  setup (props) {
    const nuxtApp = useNuxtApp()

    return () => {
      return h(RouterView, {}, {
        default: (routeProps: RouterViewSlotProps) => routeProps.Component &&
            wrapIf(Transition, routeProps.route.meta.pageTransition ?? defaultPageTransition,
              wrapInKeepAlive(routeProps.route.meta.keepalive, h(Suspense, {
                onPending: () => nuxtApp.callHook('page:start', routeProps.Component),
                onResolve: () => nuxtApp.callHook('page:finish', routeProps.Component)
              }, { default: () => h(routeProps.Component, { key: generateRouteKey(props.pageKey, routeProps) } as {}) }))).default()
      })
    }
  }
})

const defaultPageTransition = { name: 'page', mode: 'out-in' }
