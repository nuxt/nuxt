import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, mergeProps, watch } from 'vue'
import type { AsyncComponentLoader, HydrationStrategy } from 'vue'

/* @__NO_SIDE_EFFECTS__ */
export const createLazyVisibleComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrateOnVisible: {
        type: [Object, Boolean] as unknown as () => true | IntersectionObserverInit,
        required: false,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnVisible(props.hydrateOnVisible === true ? undefined : props.hydrateOnVisible) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIdleComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrateOnIdle: {
        type: [Number, Boolean] as unknown as () => true | number,
        required: true,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (props.hydrateOnIdle === 0) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnIdle(props.hydrateOnIdle === true ? undefined : props.hydrateOnIdle) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyInteractionComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrateOnInteraction: {
        type: [String, Array] as unknown as () => keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true,
        required: false,
        default: ['pointerenter', 'focus'] satisfies Array<keyof HTMLElementEventMap>,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnInteraction(props.hydrateOnInteraction === true ? ['pointerenter', 'focus'] : props.hydrateOnInteraction) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaQueryComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrateOnMediaQuery: {
        type: String as unknown as () => string,
        required: true,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(props.hydrateOnMediaQuery) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrateWhen: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (props.hydrateWhen) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(() => props.hydrateWhen, () => hydrate(), { once: true })
        return () => unwatch()
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyTimeComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrateAfter: {
        type: Number,
        required: true,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (props.hydrateAfter === 0) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const id = setTimeout(hydrate, props.hydrateAfter)
        return () => clearTimeout(id)
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}
