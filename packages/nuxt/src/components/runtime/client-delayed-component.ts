import { defineAsyncComponent, defineComponent, getCurrentInstance, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnVisible } from 'vue'
import type { AsyncComponentLoader } from 'vue'
// import ClientOnly from '#app/components/client-only'
import { useNuxtApp } from '#app/nuxt'

function elementIsVisibleInViewport (el: Element) {
  const { top, left, bottom, right } = el.getBoundingClientRect()
  const { innerHeight, innerWidth } = window
  return ((top > 0 && top < innerHeight) ||
    (bottom > 0 && bottom < innerHeight)) &&
    ((left > 0 && left < innerWidth) || (right > 0 && right < innerWidth))
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(componentLoader, attrs)
      }

      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!

      if (instance.vnode.el && nuxt.isHydrating && elementIsVisibleInViewport(instance.vnode.el as Element)) {
        return h(componentLoader, attrs)
      }

      return () => h(defineAsyncComponent({
        loader: componentLoader,
        hydrate: hydrateOnVisible(attrs.hydrate as IntersectionObserverInit | undefined),
      }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(componentLoader, attrs)
      }
      return () => defineAsyncComponent({
        loader: componentLoader,
        hydrate: hydrateOnIdle(attrs.hydrate as number | undefined),
      })
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyEventComponent = (componentLoader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(componentLoader, attrs)
      }
      const events: Array<keyof HTMLElementEventMap> = attrs.hydrate as Array<keyof HTMLElementEventMap> ?? ['mouseover']
      return () => h(defineAsyncComponent({
        loader: componentLoader,
        hydrate: hydrateOnInteraction(events),
      }))
    },
  })
}
