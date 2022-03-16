import type { RouterOptions as _RouterOptions  } from 'vue-router'


export type RouterOptions = Exclude<_RouterOptions, 'history' | 'routes'>

/**
 * Only JSON serializable router options are configurable from nuxt config
 */
export type RouterConfigOptions = Pick<RouterOptions, 'linkActiveClass' | 'linkExactActiveClass' | 'end' | 'sensitive' | 'strict'>
