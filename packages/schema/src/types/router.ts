import type { RouterOptions as _RouterOptions, RouterHistory } from 'vue-router'


export type RouterOptions = Partial<Omit<_RouterOptions, 'history' | 'routes'>> & {
  history?: (baseURL?: string) => RouterHistory
  routes?: (_routes: _RouterOptions['routes']) => _RouterOptions['routes']
}

export type RouterConfig = RouterOptions

/**
 * Only JSON serializable router options are configurable from nuxt config
 */
export type RouterConfigSerializable = Pick<RouterConfig, 'linkActiveClass' | 'linkExactActiveClass' | 'end' | 'sensitive' | 'strict'>


/** @deprecated Use RouterConfigSerializable instead */
export type RouterConfigOptions = RouterConfigSerializable
