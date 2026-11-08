import process from 'node:process'

export default defineEventHandler((event) => {
  const shared = useRuntimeConfig()
  const first = useRuntimeConfig(event)
  first.public.mode = 'production'

  const previousPort = process.env.NUXT_PORT
  process.env.NUXT_PORT = '5001'
  try {
    const second = useRuntimeConfig({ ...event, context: {} } as typeof event)
    return {
      sharedIsStable: useRuntimeConfig() === shared,
      sharedIsFrozen: Object.isFrozen(shared) && Object.isFrozen(shared.public),
      eventIsCached: useRuntimeConfig(event) === first,
      eventIsCopy: first !== shared,
      secondPort: second.port,
      secondMode: second.public.mode,
      sharedPort: shared.port,
      sharedMode: shared.public.mode,
    }
  } finally {
    if (previousPort === undefined) {
      delete process.env.NUXT_PORT
    } else {
      process.env.NUXT_PORT = previousPort
    }
  }
})
