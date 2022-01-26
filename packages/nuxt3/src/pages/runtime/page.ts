import { Component, defineComponent, KeepAlive, h, Suspense, Transition } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NuxtLayout from './layout'
import { useNuxtApp } from '#app'
// @ts-ignore
import layouts from '#build/layouts'

type InstanceOf<T> = T extends new (...args: any[]) => infer R ? R : never
type RouterViewSlotProps = Parameters<InstanceOf<typeof RouterView>['$slots']['default']>[0]

export default defineComponent({
  name: 'NuxtPage',
  props: {
    layout: {
      type: String,
      default: null
    }
  },
  setup (props) {
    const nuxtApp = useNuxtApp()
    const route = useRoute()

    return () => {
      // We avoid rendering layout transition if there is no layout to render
      const hasLayout = props.layout ?? route.meta.layout ?? 'default' in layouts

      return h(RouterView, {}, {
        default: ({ Component }: RouterViewSlotProps) => Component &&
        wrapIf(Transition, hasLayout && (route.meta.layoutTransition ?? defaultLayoutTransition),
          wrapIf(NuxtLayout, hasLayout && { name: props.layout ?? route.meta.layout },
            wrapIf(Transition, route.meta.pageTransition ?? defaultPageTransition,
              wrapInKeepAlive(route.meta.keepalive, h(Suspense, {
                onPending: () => nuxtApp.callHook('page:start', Component),
                onResolve: () => nuxtApp.callHook('page:finish', Component)
              }, { default: () => h(Component) })
              )
            )
          )).default()
      })
    }
  }
})

const Fragment = {
  setup (props, { slots }) {
    return () => slots.default()
  }
}

const wrapIf = (component: Component, props: any, slots: any) => {
  return { default: () => props ? h(component, props === true ? {} : props, slots) : h(Fragment, {}, slots) }
}

const wrapInKeepAlive = (props: any, children: any) => {
  return { default: () => process.client && props ? h(KeepAlive, props === true ? {} : props, children) : children }
}

const defaultLayoutTransition = { name: 'layout', mode: 'out-in' }
const defaultPageTransition = { name: 'page', mode: 'out-in' }
