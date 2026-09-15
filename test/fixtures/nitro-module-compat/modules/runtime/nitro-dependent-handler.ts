// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'
// @ts-expect-error a virtual rendered only once the nitro instance exists
import { preset } from '#compat-virtual/nitro-dependent'

export default defineEventHandler((event) => {
  return {
    flavour: useRuntimeConfig(event).public.flavour,
    preset,
  }
})
