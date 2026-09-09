// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'

export default defineEventHandler((event) => {
  return {
    flavour: useRuntimeConfig(event).public.flavour,
    hasQuery: typeof getQuery(event) === 'object',
  }
})
