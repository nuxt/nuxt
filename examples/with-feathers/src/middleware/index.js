import nuxt from './nuxt'

export default function () {
  // Add your custom middleware here. Remember, that
  // just like Express the order matters, so error
  // handling middleware should go last.
  const app = this

  app.use(nuxt)
}
