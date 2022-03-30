import type { RouterOptions as _RouterOptions  } from 'vue-router'


export type RouterConfig = Partial<Omit<_RouterOptions, 'history' | 'routes'>>

/** @deprecated Use RouterConfig instead */
export type RouterOptions = RouterConfig

/**
 * Only JSON serializable router options are configurable from nuxt config
 */
export type RouterConfigSerializable = Pick<RouterConfig, 'linkActiveClass' | 'linkExactActiveClass' | 'end' | 'sensitive' | 'strict'>


/** @deprecated Use RouterConfigSerializable instead */
export type RouterConfigOptions = RouterConfigSerializable
