export default function ({ app, error }) {
  app.router.beforeEach((to, from, next) => {
    if (to.path !== '/router-guard-error') {
      return next()
    }

    if (to.query.error) {
      error(new Error(to.query.error))
    }

    if (to.query.throw) {
      next(new Error(to.query.throw))
    } else {
      next(false)
    }
  })
}
