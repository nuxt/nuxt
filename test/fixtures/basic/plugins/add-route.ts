export default defineNuxtPlugin((_nuxtApp) => {
  const router = useRouter()

  router.beforeEach((to) => {
    if (to.path !== '/add-route-test') { return }
    if (router.getRoutes().some(route => route.path === to.path)) {
      return
    }

    router.addRoute({
      path: to.path,
      name: to.path,
      component: () => import('~/pages/index.vue')
    })

    return to.path
  })
})
