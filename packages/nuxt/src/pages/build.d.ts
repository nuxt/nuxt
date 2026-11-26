declare module '#build/router.options.mjs' {
  import type { RouterOptions } from '@nuxt/schema'

  export const hashMode: boolean
  const _default: RouterOptions
  export default _default
}

declare module '#build/routes' {
  import type { RouterOptions } from '@nuxt/schema'
  import type { Router, RouterOptions as VueRouterOptions } from 'vue-router'
  import type { EXPERIMENTAL_RouterOptions } from 'vue-router/experimental'

  /** With the experimental router only the router is needed, as its resolver is replaced. */
  export const handleHotUpdate: (_router: Router, _generateRoutes?: RouterOptions['routes']) => void

  /** The route resolver, with the experimental router. */
  export const resolver: EXPERIMENTAL_RouterOptions['resolver']
  /** The paths of the pages without params, with the experimental router. */
  export const prerenderPaths: string[]

  const _default: VueRouterOptions['routes']
  export default _default
}
