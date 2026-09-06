import { HTTPError, writeEarlyHints } from 'nitro/h3'
import { getRouteRules, useNitroHooks } from 'nitro/app'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { FastResponse } from 'srvx'
import type { NuxtSSRContext } from '#app/types'
import { createRendererInstance } from 'nuxt/internal/renderer/instance'
import type { NuxtRendererInstance } from 'nuxt/internal/renderer/instance'
import type { NuxtRendererOptions, RendererHooks, RendererRouteRules } from 'nuxt/internal/renderer/runtime'

import '../../context'

import { NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'
import { buildAssetsURL, publicAssetsURL } from '#internal/nuxt/paths'
import { withBaseURL } from '../base'
import { payloadCache, prerenderRenderingURLs, sharedPrerenderCache } from '../cache'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

/** The capabilities Nitro provides to the Nuxt renderer. */
export const rendererOptions: NuxtRendererOptions = {
  runtimeConfig: () => useRuntimeConfig() as NuxtSSRContext['runtimeConfig'],
  buildAssetsURL,
  publicAssetsURL,
  // nitro registers route rules under the base URL, which `createEvent` has removed
  getRouteRules: event => (getRouteRules(event.req.method, withBaseURL(event.url.pathname)).routeRules || {}) satisfies RendererRouteRules,
  hooks: () => useNitroHooks() as RendererHooks,
  createResponse: (body, init) => new FastResponse(body, init),
  createError: init => new HTTPError(init),
  writeEarlyHints: (event, hints) => writeEarlyHints(event, hints),
  renderIsland: event => import('#internal/nuxt/island-renderer.mjs').then(r => r.default.fetch(event.req)),
  onRenderSuccess: import.meta.dev
    ? () => {
        // a page rendered, so overlays showing the previous error can be dismissed
        import('../error-channel').then(({ useErrorChannel }) => useErrorChannel()).then((channel) => {
          if (channel.current) {
            channel.clearError()
          }
        }).catch(() => {})
      }
    : undefined,
  prerender: import.meta.prerender
    ? {
        payloadCache: payloadCache!,
        sharedDataCache: NUXT_SHARED_DATA ? sharedPrerenderCache! : undefined,
        wrapRender: (event, render) => {
          const renderingURL = event.url.pathname + event.url.search
          const stack = prerenderRenderingURLs!.getStore()
          // a `useFetch`/`$fetch` against the URL currently rendering deadlocks the
          // build: https://github.com/nuxt/nuxt/issues/33871
          if (stack?.includes(renderingURL)) {
            const chain = [...stack, renderingURL].filter(url => !url.startsWith('/__nuxt_error')).map(url => `"${url}"`).join(' -> ')
            throw new HTTPError({
              status: 508,
              statusText: `Loop detected while prerendering "${renderingURL}" (${chain}). Check for \`useFetch\`/\`$fetch\` calls targeting a URL that is currently being rendered.`,
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
