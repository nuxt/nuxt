import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, mergeProps, ref, watch } from 'vue'
import type { AsyncComponentLoader, HydrationStrategy } from 'vue'

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnVisible(attrs.hydrate as IntersectionObserverInit | undefined) })
      const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
      // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
      return () => h(comp, merged)
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
      if (attrs.hydrate === 0) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, merged)
      }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnIdle(attrs.hydrate as number | undefined) })
      // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
      return () => h(comp, merged)
    },
  })
}

type HTMLEvent = keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap>
/* @__NO_SIDE_EFFECTS__ */
export const createLazyEventComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const events: HTMLEvent = attrs.hydrate as HTMLEvent ?? 'mouseover'
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnInteraction(events) })
      const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
      // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
      return () => h(comp, merged)
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const mediaQuery = attrs.hydrate as string ?? '(min-width: 1px)'
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(mediaQuery) })
      const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
      // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
      return () => h(comp, merged)
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const shouldHydrate = ref(!!(attrs.hydrate ?? true))
      if (shouldHydrate.value) {
        const comp = defineAsyncComponent(loader)
        const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
        // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
        return () => h(comp, merged)
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(shouldHydrate, () => hydrate(), { once: true })
        return () => unwatch()
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      return () => h(comp, attrs)
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyTimeComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
      if (attrs.hydrate === 0) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, merged)
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const id = setTimeout(hydrate, attrs.hydrate as number | undefined ?? 2000)
        return () => clearTimeout(id)
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
      return () => h(comp, merged)
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyPromiseComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const merged = mergeProps(attrs, { 'data-allow-mismatch': '' })
      // @ts-expect-error Attributes cannot be typed
      if (!attrs.hydrate || typeof attrs.hydrate.then !== 'function') {
        const comp = defineAsyncComponent(loader)
        // TODO: fix hydration mismatches on Vue's side. The data-allow-mismatch is ideally a temporary solution due to Vue's SSR limitation with hydrated content.
        return () => h(comp, merged)
      }
      const strategy: HydrationStrategy = (hydrate) => {
        // @ts-expect-error Attributes cannot be typed
        attrs.hydrate.then(hydrate)
        return () => {}
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      return () => h(comp, merged)
    },
  })
}
