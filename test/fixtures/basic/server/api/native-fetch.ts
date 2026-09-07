import { serverFetch } from 'nitro'

export default defineEventHandler(async () => ({
  globalFetchPatched: globalThis.fetch === serverFetch,
  internal: await $fetch('/api/hello'),
}))
