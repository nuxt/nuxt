import type { RouterHistory, RouterOptions as _RouterOptions } from 'vue-router'

export type RouterOptions = Partial<Omit<_RouterOptions, 'history' | 'routes'>> & {
  history?: (baseURL?: string) => RouterHistory | null | undefined
  routes?: (_routes: _RouterOptions['routes']) => _RouterOptions['routes'] | Promise<_RouterOptions['routes']>
  hashMode?: boolean
  scrollBehaviorType?: 'smooth' | 'auto'
}

export type RouterConfig = RouterOptions

/**
 * Only JSON serializable router options are configurable from nuxt config
 */
export type RouterConfigSerializable = Pick<RouterConfig, 'linkActiveClass' | 'linkExactActiveClass' | 'end' | 'sensitive' | 'strict' | 'hashMode' | 'scrollBehaviorType'>

/**
 * Create a NuxtLink component with given options as defaults.
 *
 * Declared without reference to `vue-router`'s link types, which would otherwise force a
 * (possibly duplicated) `vue-router` instance into every consuming program.
 * @see https://nuxt.com/docs/4.x/api/components/nuxt-link
 */
export interface NuxtLinkOptions {
  /**
   * The name of the component.
   * @default "NuxtLink"
   */
  componentName?: string
  /**
   * A default `rel` attribute value applied on external links. Defaults to `"noopener noreferrer"`. Set it to `""` to disable.
   */
  externalRelAttribute?: string | null
  /**
   * An option to either add or remove trailing slashes in the `href`.
   * If unset or not matching the valid values `append` or `remove`, it will be ignored.
   */
  trailingSlash?: 'append' | 'remove'
  /** A class to apply to active links. */
  activeClass?: string
  /** A class to apply to exact active links. */
  exactActiveClass?: string
  /** A class to apply to links that have been prefetched. */
  prefetchedClass?: string
  /** When enabled will prefetch middleware, layouts and payloads of links in the viewport. */
  prefetch?: boolean
  /**
   * Allows controlling default setting for when to prefetch links. By default, prefetch is triggered only on visibility.
   */
  prefetchOn?: Partial<{
    visibility: boolean
    interaction: boolean
  }>
}
