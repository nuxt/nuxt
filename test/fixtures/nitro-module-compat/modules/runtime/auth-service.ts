// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'

// reached only through the module's own `#legacy-auth` alias, imported by a user
// route: never a handler entry, an `addServerImports` source or a template
export function handleAuth (event: H3Event) {
  return {
    flavour: useRuntimeConfig(event).public.flavour,
    method: getMethod(event),
  }
}
