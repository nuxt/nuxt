const middleware = defineNuxtRouteMiddleware(() => {
  // Global middleware
})

Object.defineProperty(middleware, 'name', { value: 'test-global' })

export default middleware
