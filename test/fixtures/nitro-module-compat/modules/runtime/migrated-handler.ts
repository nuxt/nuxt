import { HTTPError, defineHandler, getQuery } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

// this module code has migrated to nitro v3: the compat layer has to leave it alone
export default defineHandler((event) => {
  if (getQuery(event).fail) {
    // a v3 error: its body must not grow v2 keys
    throw new HTTPError({ status: 410, statusText: 'Gone' })
  }

  return { flavour: useRuntimeConfig().public.flavour }
})
