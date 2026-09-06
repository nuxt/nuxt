import { createError, writeEarlyHints } from 'h3'
import { getRouteRules, useNitroApp, useRuntimeConfig } from 'nitropack/runtime'
import { createRendererInstance } from 'nuxt/internal/renderer/instance'
import type { NuxtRendererInstance } from 'nuxt/internal/renderer/instance'
import type { NuxtRendererOptions, RendererHooks, RendererRouteRules } from 'nuxt/internal/renderer/runtime'
import type { NuxtSSRContext } from '#app/types'

import { NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'
import { buildAssetsURL, publicAssetsURL } from '../paths'
import { getH3Event } from '../event'
import { payloadCache, prerenderRenderingURLs, sharedPrerenderCache } from '../cache'
import { NodeRenderResponse } from '../response'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

/** The capabilities a nitropack v2 host provides to the Nuxt renderer. */
export const rendererOptions: NuxtRendererOptions = {
  runtimeConfig: event => useRuntimeConfig(getH3Event(event)) as NuxtSSRContext['runtimeConfig'],
  buildAssetsURL,
  publicAssetsURL,
  getRouteRules: event => getRouteRules(getH3Event(event)) satisfies RendererRouteRules,
  hooks: () => useNitroApp().hooks as unknown as RendererHooks,
  // the response never leaves this bundle, so the fields the renderer sets are enough
  createResponse: (body, init) => new NodeRenderResponse(body, init) as unknown as Response,
  // h3 v1 reads the message of an error from `message`/`statusMessage`, and recognises an
  // error of its own by the marker its constructor carries, so this cannot construct one
  createError: init => createError({
    statusCode: init.status,
    statusMessage: init.statusText,
    message: init.statusText,
    data: init.data,
  }),
  writeEarlyHints: (event, hints) => writeEarlyHints(getH3Event(event), hints.link),
  prerender: import.meta.prerender
    ? {
        payloadCache: payloadCache as unknown as NonNullable<NuxtRendererOptions['prerender']>['payloadCache'],
        sharedDataCache: NUXT_SHARED_DATA ? sharedPrerenderCache! : undefined,
        wrapRender: (event, render) => {
          const renderingURL = getH3Event(event).path
          const stack = prerenderRenderingURLs!.getStore()
          // a `useFetch`/`$fetch` against the URL currently rendering deadlocks the
          // build: https://github.com/nuxt/nuxt/issues/33871
          if (stack?.includes(renderingURL)) {
            const chain = [...stack, renderingURL].filter(url => !url.startsWith('/__nuxt_error')).map(url => `"${url}"`).join(' -> ')
            throw createError({
              statusCode: 508,
              statusMessage: `Loop detected while prerendering "${renderingURL}" (${chain}). Check for \`useFetch\`/\`$fetch\` calls targeting a URL that is currently being rendered.`,
            })
          }
          return prerenderRenderingURLs!.run([...(stack || []), renderingURL], render)
        },
      }
    : undefined,
}

/**
 * The renderer the page and island handlers share, so that both render against a single
 * load of the server bundle and its manifest.
 */
export const rendererInstance: NuxtRendererInstance = createRendererInstance(rendererOptions)
