export default defineNuxtPlugin(() => {
  const timer = useState('timer', () => 0)

  if (process.client) {
    addRouteMiddleware(async () => {
      console.log('Starting timer...')
      timer.value = 5
      do {
        await new Promise(resolve => setTimeout(resolve, 100))
        timer.value--
      } while (timer.value)
      console.log('...and navigating')
    })
  }

  addRouteMiddleware((to) => {
    if (to.path === '/forbidden') {
      return false
    }
  })

  addRouteMiddleware((to) => {
    const { $config } = useNuxtApp()
    if ($config) {
      console.log('Accessed runtime config within middleware.')
    }

    if (to.path !== '/redirect') { return }

    console.log('Heading to', to.path, 'but I think we should go somewhere else...')
    return '/secret'
  })
})
