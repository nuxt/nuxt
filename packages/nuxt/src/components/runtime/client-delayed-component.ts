import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, mergeProps, watch } from 'vue'
import type { AsyncComponentLoader, HydrationStrategy } from 'vue'

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrate: {
        type: Object,
        required: false,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnVisible(props.hydrate as IntersectionObserverInit | undefined) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrate: {
        type: Number,
        required: false,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (props.hydrate === 0) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnIdle(props.hydrate) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyEventComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrate: {
        type: [String, Array] as unknown as () => keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap>,
        required: false,
        default: 'mouseover',
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnInteraction(props.hydrate) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrate: {
        type: String,
        required: false,
        default: '(min-width: 1px)',
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      const comp = defineAsyncComponent({ loader, hydrate: hydrateOnMediaQuery(props.hydrate) })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrate: {
        type: Boolean,
        required: false,
        default: true,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (props.hydrate) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const unwatch = watch(() => props.hydrate, () => hydrate(), { once: true })
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
      hydrate: {
        type: Number,
        required: false,
        default: 2000,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (props.hydrate === 0) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const strategy: HydrationStrategy = (hydrate) => {
        const id = setTimeout(hydrate, props.hydrate)
        return () => clearTimeout(id)
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyPromiseComponent = (loader: AsyncComponentLoader) => {
  return defineComponent({
    inheritAttrs: false,
    props: {
      hydrate: {
        type: Promise,
        required: false,
      },
    },
    emits: ['hydrated'],
    setup (props, { attrs, emit }) {
      const hydrated = () => { emit('hydrated') }
      if (!props.hydrate) {
        const comp = defineAsyncComponent(loader)
        return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
      }
      const strategy: HydrationStrategy = (hydrate) => {
        props.hydrate!.then(hydrate)
        return () => {}
      }
      const comp = defineAsyncComponent({ loader, hydrate: strategy })
      return () => h(comp, mergeProps(attrs, { 'onVnodeMounted': hydrated }))
    },
  })
}
