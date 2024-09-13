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
      if (import.meta.server) {
        return () => h(defineAsyncComponent(loader), attrs)
      }
      const ready = ref(false)
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      onNuxtReady(() => ready.value = true)
      // This one, unlike others, can cause a hydration mismatch even a whole minute after the page loads. Given a query of min-width: 1200px, with a small window, the moment the window expands to at least 1200 it hydrates and causes a hydration mismatch.
      return () => ready.value ? h(defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(attrs.hydrate ?? '(min-width: 1px)') })) : nuxt.isHydrating && instance.vnode.el ? h('div', attrs) : null
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
        return () => h(comp, merged)
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(shouldHydrate, () => hydrate(), { once: true })
        return () => unwatch()
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      // This one seems to work fine whenever the hydration condition is achieved at client side. For example, a hydration condition of a ref greater than 2 with a button to increment causes no hydration mismatch after 3 presses of the button.
      return () => h(comp, attrs)
    },
  })
}
