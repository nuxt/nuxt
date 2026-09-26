import { createError, defineEventHandler, getQuery } from 'h3'
// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'
import { useStorage } from 'nitropack/runtime'
// @ts-expect-error nitro v2 internal specifier
import { useNitroApp } from '#internal/nitro'

export default defineEventHandler((event) => {
  if (getQuery(event).fail) {
    throw createError({ statusCode: 418, statusMessage: 'I am a teapot', data: { from: 'untagged' } })
  }

  return {
    flavour: useRuntimeConfig(event).public.flavour,
    hasStorage: typeof useStorage === 'function',
    hasNitroApp: typeof useNitroApp === 'function',
  }
})
