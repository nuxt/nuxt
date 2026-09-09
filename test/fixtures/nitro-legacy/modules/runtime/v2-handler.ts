import { createError, defineEventHandler, getQuery } from 'h3'
// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'
import { useStorage } from 'nitropack/runtime'

import { describeEvent } from './v2-utils'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  if (getQuery(event).fail) {
    throw createError({ statusCode: 418, statusMessage: 'I am a teapot', data: { from: 'v2-module' } })
  }

  return {
    flavour: config.public.flavour,
    hasStorage: typeof useStorage === 'function',
    secret: config.secret,
    ...describeEvent(event),
  }
})
