import { createRouter } from 'vue-router'
import { createRouterPlugin } from './router-base'

// @ts-ignore
import _routes from '#build/routes'

export default createRouterPlugin((history, routerOptions) => {
  const routes = routerOptions.routes?.(_routes) ?? _routes
  return createRouter({
    ...routerOptions,
    history,
    routes
  })
})
