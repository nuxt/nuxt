import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, ref, watch } from 'vue'
import type { AsyncComponentLoader, HydrationStrategy } from 'vue'

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
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
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      return () => h(defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(attrs.hydrate ?? '(min-width: 1px)') }))
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
      const shouldHydrate = ref(!!(attrs.hydrate ?? true))
      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(shouldHydrate, () => hydrate(), { once: true })
        return () => unwatch()
      }
      return () => h(defineAsyncComponent({ loader, hydrate: strategy }))
    },
  })
}
