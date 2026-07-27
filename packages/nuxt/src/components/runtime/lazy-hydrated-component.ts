import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnInteraction, hydrateOnMediaQuery, hydrateOnVisible, mergeProps } from 'vue'
import type { AsyncComponentLoader, ComponentObjectPropsOptions, DefineSetupFnComponent, ExtractPropTypes, HydrationStrategy } from 'vue'
import { useNuxtApp } from '#app/nuxt'

type LazyHydrationEmits = {
  hydrated: () => void
}

type LazyComponentFactory<Props extends Record<string, any>> = (id: string, loader: AsyncComponentLoader) => DefineSetupFnComponent<Props, LazyHydrationEmits>

function defineLazyComponent<P extends ComponentObjectPropsOptions, Props extends Record<string, any> = ExtractPropTypes<P>> (props: P, defineStrategy: (props: ExtractPropTypes<P>) => HydrationStrategy | undefined): LazyComponentFactory<Props> {
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
  }) as unknown as DefineSetupFnComponent<Props, LazyHydrationEmits>
}

interface LazyVisibleProps { hydrateOnVisible?: true | IntersectionObserverInit }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyVisibleComponent: LazyComponentFactory<LazyVisibleProps> = defineLazyComponent({
  hydrateOnVisible: {
    type: [Object, Boolean] as unknown as () => true | IntersectionObserverInit,
    required: false,
    default: true,
  },
},
props => hydrateOnVisible(props.hydrateOnVisible === true ? undefined : props.hydrateOnVisible),
)

interface LazyIdleProps { hydrateOnIdle?: true | number }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIdleComponent: LazyComponentFactory<LazyIdleProps> = defineLazyComponent({
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

const defaultInteractionEvents: Array<keyof HTMLElementEventMap> = ['pointerenter', 'click', 'focus']

interface LazyInteractionProps { hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyInteractionComponent: LazyComponentFactory<LazyInteractionProps> = defineLazyComponent({
  hydrateOnInteraction: {
    type: [String, Array] as unknown as () => keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true,
    required: false,
    default: (): Array<keyof HTMLElementEventMap> => defaultInteractionEvents,
  },
},
props => hydrateOnInteraction(props.hydrateOnInteraction === true ? defaultInteractionEvents : (props.hydrateOnInteraction || defaultInteractionEvents)),
)

interface LazyMediaQueryProps { hydrateOnMediaQuery: string }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyMediaQueryComponent: LazyComponentFactory<LazyMediaQueryProps> = defineLazyComponent({
  hydrateOnMediaQuery: {
    type: String as unknown as () => string,
    required: true,
  },
},
props => hydrateOnMediaQuery(props.hydrateOnMediaQuery),
)

interface LazyIfProps { hydrateWhen?: boolean }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIfComponent: LazyComponentFactory<LazyIfProps> = defineLazyComponent({
  hydrateWhen: {
    type: Boolean,
    default: true,
  },
},
props => props.hydrateWhen
  ? undefined /* hydrate immediately */
  : () => {}, /* Vue will trigger the hydration automatically when the prop changes */
)

interface LazyTimeProps { hydrateAfter: number }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyTimeComponent: LazyComponentFactory<LazyTimeProps> = defineLazyComponent({
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

interface LazyNeverProps { hydrateNever?: true }

/* @__NO_SIDE_EFFECTS__ */
const hydrateNever = (): void => {}
export const createLazyNeverComponent: LazyComponentFactory<LazyNeverProps> = defineLazyComponent({
  hydrateNever: {
    type: Boolean as () => true,
    required: false,
    default: true,
  },
},
() => hydrateNever,
)
