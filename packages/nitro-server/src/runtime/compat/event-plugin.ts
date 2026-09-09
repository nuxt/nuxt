import { definePlugin } from 'nitro'
import { fetch as nitroFetch } from 'nitro/app'
import { createFetch } from 'ofetch'
import type { H3Event } from 'nitro/h3'

import { decorateLegacyEvent } from './decorate.ts'
import { useRuntimeConfig } from './runtime-config.ts'
import { observeLegacyHooks } from './hook-registry.ts'
import './import-meta.ts'

/** Give every routed event the Nitro v2 shape module code expects. */
export default definePlugin((nitroApp) => {
  observeLegacyHooks(nitroApp.hooks)

  // v2 seeded `globalThis.$fetch` when the server started; v3 leaves it to the app entry,
  // which a request that renders no page never loads
  globalThis.$fetch ||= createFetch({
    fetch: nitroFetch as typeof globalThis.fetch,
    defaults: { baseURL: (useRuntimeConfig() as { app?: { baseURL?: string } }).app?.baseURL },
  }) as typeof globalThis.$fetch

  nitroApp.hooks?.hook('request', (httpEvent) => {
    decorateLegacyEvent(httpEvent as H3Event, nitroApp)
  })
})
