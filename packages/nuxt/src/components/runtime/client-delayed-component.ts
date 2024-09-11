import { defineAsyncComponent, defineComponent, getCurrentInstance, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, ref, watch } from 'vue'
import type { AsyncComponentLoader, HydrationStrategy } from 'vue'
import { onNuxtReady, useNuxtApp } from '#app'

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const ready = ref(false)
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      onNuxtReady(() => ready.value = true)
      // This is a hack to prevent hydration mismatches for all hydration strategies
      return () => ready.value ? h(defineAsyncComponent({ loader, hydrate: hydrateOnVisible(attrs.hydrate as IntersectionObserverInit | undefined) })) : nuxt.isHydrating && instance.vnode.el ? h('div', attrs) : null
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const ready = ref(false)
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      onNuxtReady(() => ready.value = true)
      // This one seems to work fine due to the intended use case
      return () => ready.value ? h(defineAsyncComponent({ loader, hydrate: hydrateOnIdle(attrs.hydrate as number | undefined) })) : nuxt.isHydrating && instance.vnode.el ? h('div', attrs) : null
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyEventComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const ready = ref(false)
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      onNuxtReady(() => ready.value = true)
      const events: Array<keyof HTMLElementEventMap> = attrs.hydrate as Array<keyof HTMLElementEventMap> ?? ['mouseover']
      return () => ready.value ? h(defineAsyncComponent({ loader, hydrate: hydrateOnInteraction(events) })) : nuxt.isHydrating && instance.vnode.el ? h('div', attrs) : null
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const ready = ref(false)
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      onNuxtReady(() => ready.value = true)
      // This one, unlike others, can cause a hydration mismatch even a whole minute after the page loads. Given a query of min-width: 1200px, with a small window, the moment the window expands to at least 1200 it hydrates and causes a hydration mismatch.
      return () => ready.value ? h(defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(attrs.hydrate as string ?? '(min-width: 1px)') })) : nuxt.isHydrating && instance.vnode.el ? h('div', attrs) : null
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const ready = ref(false)
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      onNuxtReady(() => ready.value = true)
      const shouldHydrate = ref(!!(attrs.hydrate ?? true))
      const strategy: HydrationStrategy = (hydrate) => {
        if (!shouldHydrate.value) {
          const unwatch = watch(shouldHydrate, () => hydrate(), { once: true })
          return () => unwatch()
        }
        hydrate()
        return () => {}
      }
      // This one seems to work fine whenever the hydration condition is achieved at client side. For example, a hydration condition of a ref greater than 2 with a button to increment causes no hydration mismatch after 3 presses of the button.
      return () => ready.value ? h(defineAsyncComponent({ loader, hydrate: strategy })) : nuxt.isHydrating && instance.vnode.el ? h('div', attrs) : null
    },
  })
}
