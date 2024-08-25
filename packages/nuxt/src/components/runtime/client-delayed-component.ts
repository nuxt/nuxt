import { defineAsyncComponent, defineComponent, getCurrentInstance, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, ref, watch } from 'vue'
import type { AsyncComponentLoader, HydrationStrategy } from 'vue'
import { useNuxtApp } from '#app/nuxt'

function elementIsVisibleInViewport (el: Element) {
  const { top, left, bottom, right } = el.getBoundingClientRect()
  const { innerHeight, innerWidth } = window
  return ((top > 0 && top < innerHeight) ||
    (bottom > 0 && bottom < innerHeight)) &&
    ((left > 0 && left < innerWidth) || (right > 0 && right < innerWidth))
}

function delayedHydrationComponent (loader: AsyncComponentLoader, hydrate: HydrationStrategy) {
  return defineAsyncComponent({
    loader,
    hydrate,
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }

      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!

      if (instance.vnode.el && nuxt.isHydrating && elementIsVisibleInViewport(instance.vnode.el as Element)) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }

      return () => h(delayedHydrationComponent(componentLoader, hydrateOnVisible(attrs.hydrate as IntersectionObserverInit | undefined)))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }
      return () => h(delayedHydrationComponent(componentLoader, hydrateOnIdle(attrs.hydrate as number | undefined)))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyEventComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }
      const events: Array<keyof HTMLElementEventMap> = attrs.hydrate as Array<keyof HTMLElementEventMap> ?? ['mouseover']
      return () => h(delayedHydrationComponent(componentLoader, hydrateOnInteraction(events)))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }
      return () => h(delayedHydrationComponent(componentLoader, hydrateOnMediaQuery(attrs.hydrate as string | undefined ?? '')))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }
      const shouldHydrate = ref(!!(attrs.hydrate ?? true))
      if (shouldHydrate.value) {
        return () => h(defineAsyncComponent(componentLoader), attrs)
      }

      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(shouldHydrate, () => hydrate(), { once: true })
        return () => unwatch()
      }
      return () => h(delayedHydrationComponent(componentLoader, strategy))
    },
  })
}
