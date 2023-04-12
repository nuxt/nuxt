import { createRouter } from 'vue-router/auto'
import { createRouterPlugin } from './router-base'

export default createRouterPlugin((history, routerOptions) => {
  return createRouter({
    ...routerOptions,
    history
  })
})
