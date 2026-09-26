// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'
// @ts-expect-error a virtual rendered only once the app has been generated
import { templates } from '#compat-virtual/app-dependent'

export default defineEventHandler((event) => {
  return {
    flavour: useRuntimeConfig(event).public.flavour,
    templates,
  }
})
