import type { AsyncComponentLoader, Component, ComponentPublicInstance, DefineComponent } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type LazyHydrationComponent<T extends Component, Props> = T & DefineComponent<Props, {}, {}, {}, {}, {}, {}, { hydrated: () => void }>

type CombinableStrategy = 'visible' | 'idle' | 'interaction' | 'mediaQuery' | 'if' | 'time'

type CombinedHydrationProps = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap>
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
}

export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'visible', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateOnVisible?: IntersectionObserverInit | true }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'idle', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateOnIdle?: number | true }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'interaction', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'mediaQuery', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateOnMediaQuery: string }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'if', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateWhen: boolean }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'time', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateAfter: number | true }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: 'never', source: AsyncComponentLoader<T>): LazyHydrationComponent<T, { hydrateNever?: true }>
export function defineLazyHydrationComponent<T extends Component = { new (): ComponentPublicInstance }> (strategy: [CombinableStrategy, ...CombinableStrategy[]], source: AsyncComponentLoader<T>): LazyHydrationComponent<T, CombinedHydrationProps>

export function defineLazyHydrationComponent (_strategy: string | string[], _source: AsyncComponentLoader<any>): any {}
