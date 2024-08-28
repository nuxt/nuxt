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

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }

      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!

      if (instance.vnode.el && nuxt.isHydrating && elementIsVisibleInViewport(instance.vnode.el as Element)) {
        return () => h(defineAsyncComponent(loader), attrs)
      }

      return () => h(defineAsyncComponent({ loader, hydrate: hydrateOnVisible(attrs.hydrate as IntersectionObserverInit | undefined) }))
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
      return () => h(defineAsyncComponent({ loader, hydrate: hydrateOnIdle(attrs.hydrate as number | undefined) }))
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
      const events: Array<keyof HTMLElementEventMap> = attrs.hydrate as Array<keyof HTMLElementEventMap> ?? ['mouseover']
      return () => h(defineAsyncComponent({ loader, hydrate: hydrateOnInteraction(events) }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const media = attrs.hydrate as string | undefined
      if (import.meta.server || !media) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      return () => h(defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(attrs.hydrate as string | undefined ?? '') }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const condition = !!(attrs.hydrate ?? true)
      if (import.meta.server || condition) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const shouldHydrate = ref(condition)
      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(shouldHydrate, () => hydrate(), { once: true })
        return () => unwatch()
      }
      return () => h(defineAsyncComponent({ loader, hydrate: strategy }))
    },
  })
}
