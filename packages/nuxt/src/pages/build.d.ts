declare module '#build/router.options' {
  import type { RouterOptions } from '@nuxt/schema'

  export const hashMode: boolean
  const _default: RouterOptions
  export default _default
}

declare module '#build/routes' {
  import type { RouterOptions } from '@nuxt/schema'
  import type { Router, RouterOptions as VueRouterOptions } from 'vue-router'

  export const handleHotUpdate: (_router: Router, _generateRoutes: RouterOptions['routes']) => void

  const _default: VueRouterOptions['routes']
  export default _default
}
