import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, mergeProps } from 'vue'
import type { AsyncComponentLoader, ComponentObjectPropsOptions, ExtractPropTypes, HydrationStrategy } from 'vue'
import { useNuxtApp } from '#app/nuxt'

function defineLazyComponent<P extends ComponentObjectPropsOptions> (props: P, defineStrategy: (props: ExtractPropTypes<P>) => HydrationStrategy | undefined) {
  return (id: string, loader: AsyncComponentLoader) => defineComponent({
    inheritAttrs: false,
    props,
    emits: ['hydrated'],
    setup (props, ctx) {
      if (import.meta.server) {
        const nuxtApp = useNuxtApp()
        nuxtApp.hook('app:rendered', ({ ssrContext }) => {
          // track lazy hydrated components so prefetch/preload tags are not rendered for them
          // but keep them in modules so CSS links are still rendered
          ssrContext!['~lazyHydratedModules'] ||= new Set()
          ssrContext!['~lazyHydratedModules'].add(id)
        })
      }
      // wrap the async component in a second component to avoid loading the chunk too soon
      const child = defineAsyncComponent({ loader })
      const comp = defineAsyncComponent({
        hydrate: defineStrategy(props as ExtractPropTypes<P>),
        loader: () => Promise.resolve(child),
      })
      const onVnodeMounted = () => { ctx.emit('hydrated') }
      return () => h(comp, mergeProps(ctx.attrs, { onVnodeMounted }), ctx.slots)
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyVisibleComponent = defineLazyComponent({
  hydrateOnVisible: {
    type: [Object, Boolean] as unknown as () => true | IntersectionObserverInit,
    required: false,
    default: true,
  },
},
props => hydrateOnVisible(props.hydrateOnVisible === true ? undefined : props.hydrateOnVisible),
)

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIdleComponent = defineLazyComponent({
  hydrateOnIdle: {
    type: [Number, Boolean] as unknown as () => true | number,
    required: false,
    default: true,
  },
},
props => props.hydrateOnIdle === 0
  ? undefined /* hydrate immediately */
  : hydrateOnIdle(props.hydrateOnIdle === true ? undefined : props.hydrateOnIdle),
)

const defaultInteractionEvents = ['pointerenter', 'click', 'focus'] satisfies Array<keyof HTMLElementEventMap>

/* @__NO_SIDE_EFFECTS__ */
export const createLazyInteractionComponent = defineLazyComponent({
  hydrateOnInteraction: {
    type: [String, Array] as unknown as () => keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true,
    required: false,
    default: defaultInteractionEvents,
  },
},
props => hydrateOnInteraction(props.hydrateOnInteraction === true ? defaultInteractionEvents : (props.hydrateOnInteraction || defaultInteractionEvents)),
)

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaQueryComponent = defineLazyComponent({
  hydrateOnMediaQuery: {
    type: String as unknown as () => string,
    required: true,
  },
},
props => hydrateOnMediaQuery(props.hydrateOnMediaQuery),
)

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent = defineLazyComponent({
  hydrateWhen: {
    type: Boolean,
    default: true,
  },
},
props => props.hydrateWhen
  ? undefined /* hydrate immediately */
  : () => {}, /* Vue will trigger the hydration automatically when the prop changes */
)

/* @__NO_SIDE_EFFECTS__ */
export const createLazyTimeComponent = defineLazyComponent({
  hydrateAfter: {
    type: Number,
    required: true,
  },
},
props => props.hydrateAfter === 0
  ? undefined /* hydrate immediately */
  : (hydrate) => {
      const id = setTimeout(hydrate, props.hydrateAfter)
      return () => clearTimeout(id)
    },
)

/* @__NO_SIDE_EFFECTS__ */
const hydrateNever = () => {}
export const createLazyNeverComponent = defineLazyComponent({
  hydrateNever: {
    type: Boolean as () => true,
    required: false,
    default: true,
  },
},
() => hydrateNever,
)
