import { createError, defineEventHandler, getQuery } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  if (getQuery(event).fail) {
    throw createError({ statusCode: 422, statusMessage: 'Unprocessable', data: { from: 'user' } })
  }

  config.public.flavour = 'mutated-per-request'

  return {
    flavour: config.public.flavour,
    sharedFlavour: useRuntimeConfig().public.flavour,
    hasNodeBridge: !!event.node,
  }
})
