import { defineAsyncComponent, defineComponent, h, hydrateOnIdle, hydrateOnMediaQuery, hydrateOnVisible, mergeProps, provide } from 'vue'
import type { AsyncComponentLoader, ComponentObjectPropsOptions, DefineSetupFnComponent, ExtractPropTypes, HydrationStrategy } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import { neverHydratedSymbol } from '#app/composables/lazy-hydration'

type LazyHydrationEmits = {
  hydrated: () => void
}

type LazyComponentFactory<Props extends Record<string, any>> = (id: string, loader: AsyncComponentLoader) => DefineSetupFnComponent<Props, LazyHydrationEmits>

function defineLazyComponent<P extends ComponentObjectPropsOptions, Props extends Record<string, any> = ExtractPropTypes<P>> (props: P, defineStrategy: (props: ExtractPropTypes<P>, hydrated: Promise<void>) => HydrationStrategy | undefined, never = false): LazyComponentFactory<Props> {
  return (id: string, loader: AsyncComponentLoader) => {
    const child = defineAsyncComponent({ loader })
    return defineComponent({
      inheritAttrs: false,
      props,
      emits: ['hydrated'],
      setup (props, ctx) {
        if (import.meta.server) {
          if (never) {
            provide(neverHydratedSymbol, true)
          }
          const nuxtApp = useNuxtApp()
          nuxtApp.hook('app:rendered', ({ ssrContext }) => {
            // track lazy hydrated components so prefetch/preload tags are not rendered for them
            // but keep them in modules so CSS links are still rendered
            ssrContext!['~lazyHydratedModules'] ||= new Set()
            ssrContext!['~lazyHydratedModules'].add(id)
            if (never) {
              // never-hydrated chunks are also excluded from prefetch hints, as they can never be needed
              ssrContext!['~neverHydratedModules'] ||= new Set()
              ssrContext!['~neverHydratedModules'].add(id)
            }
          })
        }
        let resolveHydrated!: () => void
        const hydrated = new Promise<void>((resolve) => { resolveHydrated = resolve })
        // wrap the async component in a second component to avoid loading the chunk too soon
        const comp = defineAsyncComponent({
          hydrate: defineStrategy(props as ExtractPropTypes<P>, hydrated),
          loader: () => Promise.resolve(child),
        })
        const onVnodeMounted = () => {
          resolveHydrated()
          ctx.emit('hydrated')
        }
        return () => h(comp, mergeProps(ctx.attrs, { onVnodeMounted }), ctx.slots)
      },
    }) as unknown as DefineSetupFnComponent<Props, LazyHydrationEmits>
  }
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
const MAX_PENDING_INTERACTIONS = 50

interface LazyInteractionProps { hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true }

/* @__NO_SIDE_EFFECTS__ */
export const createLazyInteractionComponent: LazyComponentFactory<LazyInteractionProps> = defineLazyComponent({
  hydrateOnInteraction: {
    type: [String, Array] as unknown as () => keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true,
    required: false,
    default: (): Array<keyof HTMLElementEventMap> => defaultInteractionEvents,
  },
},
(props, hydrated) => (hydrate, forEach) => {
  const value = props.hydrateOnInteraction
  const interactions = value === true || !value ? defaultInteractionEvents : typeof value === 'string' ? [value] : value
  let triggered = false
  let disposed = false
  const pendingEvents: Array<{ event: Event, target: EventTarget | null }> = []
  const removeListeners = () => {
    forEach((el) => {
      for (const interaction of interactions) {
        el.removeEventListener(interaction, onInteraction, interaction === 'focus')
      }
      el.removeEventListener('pointerleave', onPointerLeave, true)
    })
  }
  const replayedEvents = new WeakSet<Event>()
  const stopPropagation = (event: Event) => {
    if (replayedEvents.has(event)) { event.stopPropagation() }
  }
  const toggleStopPropagation = (add: boolean) => {
    forEach((el) => {
      for (const interaction of interactions) {
        if (add) {
          el.addEventListener(interaction, stopPropagation)
        } else {
          el.removeEventListener(interaction, stopPropagation)
        }
      }
    })
  }
  const onPointerLeave = (event: Event) => {
    for (let index = pendingEvents.length - 1; index >= 0; index--) {
      const pending = pendingEvents[index]!
      if (pending.event.type === 'pointerenter' && pending.target === event.target) {
        pendingEvents.splice(index, 1)
      }
    }
  }
  const onInteraction = (event: Event) => {
    const input = event.type === 'input' && pendingEvents.find(pending => pending.event.type === 'input' && pending.target === event.target)
    if (input) {
      input.event = event
    } else if (pendingEvents.length < MAX_PENDING_INTERACTIONS) {
      pendingEvents.push({ event, target: event.target })
    }
    if (triggered) { return }
    triggered = true
    hydrate()
    hydrated.then(() => {
      removeListeners()
      toggleStopPropagation(true)
      for (const { event, target } of pendingEvents) {
        if (disposed) { break }
        if (event.type === 'focus' && target !== document.activeElement) { continue }
        const replay = new (event.constructor as typeof Event)(event.type, event)
        replayedEvents.add(replay)
        target?.dispatchEvent(replay)
      }
      toggleStopPropagation(false)
      pendingEvents.length = 0
    })
  }
  forEach((el) => {
    for (const interaction of interactions) {
      el.addEventListener(interaction, onInteraction, interaction === 'focus')
    }
    if (interactions.includes('pointerenter')) { el.addEventListener('pointerleave', onPointerLeave, true) }
  })
  return () => {
    disposed = true
    removeListeners()
    pendingEvents.length = 0
  }
},
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
true,
)
