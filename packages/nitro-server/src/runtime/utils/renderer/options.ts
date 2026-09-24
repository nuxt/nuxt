import { createError, getRequestURL, writeEarlyHints } from 'h3'
import type { H3Event } from 'h3'
import { getRouteRules, useNitroApp, useRuntimeConfig } from 'nitropack/runtime'
import { createRendererInstance } from 'nuxt/internal/renderer/instance'
import type { NuxtRendererInstance } from 'nuxt/internal/renderer/instance'
import { appEvent } from 'nuxt/internal/renderer/runtime'
import type { NuxtRendererOptions, RendererHooks, RendererRouteRules } from 'nuxt/internal/renderer/runtime'
import { describeError, isExpectedError } from 'nuxt/internal/renderer/error'
import { NUXT_INLINE_ERROR_RENDERING } from 'nuxt/internal/renderer-config'
import type { NuxtSSRContext } from '#app/types'

import { NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'
import { buildAssetsURL, publicAssetsURL } from '../paths'
import { payloadCache, prerenderRenderingURLs, sharedPrerenderCache } from '../cache'
import { NodeRenderResponse } from '../response'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

/** The capabilities a nitropack v2 host provides to the Nuxt renderer. */
export const rendererOptions: NuxtRendererOptions = {
  runtimeConfig: event => useRuntimeConfig(appEvent(event)) as NuxtSSRContext['runtimeConfig'],
  buildAssetsURL,
  publicAssetsURL,
  getRouteRules: event => getRouteRules(appEvent(event)) satisfies RendererRouteRules,
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
  writeEarlyHints: (event, hints) => writeEarlyHints(appEvent(event), hints.link),
  onRenderSuccess: import.meta.dev
    ? () => {
        import('#internal/nuxt/error-channel').then(({ clearErrorReport }) => clearErrorReport()).catch(() => {})
      }
    : undefined,
  prerender: import.meta.prerender
    ? {
        payloadCache: payloadCache as unknown as NonNullable<NuxtRendererOptions['prerender']>['payloadCache'],
        sharedDataCache: NUXT_SHARED_DATA ? sharedPrerenderCache! : undefined,
        wrapRender: (event, render) => {
          const renderingURL = appEvent(event).path
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

if (NUXT_INLINE_ERROR_RENDERING) {
  rendererOptions.captureError = (error, { event, tags }) => {
    const h3Event = appEvent(event) as H3Event
    // an error rendered in process never reaches nitro's error handler, which is what logs it
    if (!import.meta.dev && !isExpectedError(error, describeError(error))) {
      console.error(`[request error] [unhandled] [${h3Event.method}] ${getRequestURL(h3Event)}\n`, error)
    }
    useNitroApp().captureError?.(error as Error, { event: h3Event, tags: ['ssr', ...tags ?? []] })
  }
}

if (import.meta.dev) {
  rendererOptions.onDevError = (error, event, options) => import('#internal/nuxt/error-channel').then(({ observeDevError }) => observeDevError(error, appEvent(event) as H3Event, options))
}

/**
 * The renderer the page and island handlers share, so that both render against a single
 * load of the server bundle and its manifest.
 */
export const rendererInstance: NuxtRendererInstance = createRendererInstance(rendererOptions)
