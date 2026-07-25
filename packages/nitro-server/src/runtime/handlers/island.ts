import { useNitroHooks } from 'nitro/app'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import { H3Event, HTTPError, getQuery, readBody } from 'nitro/h3'
import { VueResolver, walkResolver } from '@unhead/vue/utils'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { FastResponse } from 'srvx'
import { getIslandHash } from '#app/island-hash'
import type { NuxtIslandContext, NuxtIslandResponse } from '#app/types'
import { traceAsync } from '#app/internal/tracing'
import { tracingChannelNuxt } from '#internal/nuxt.config.mjs'
import { createSSRContext, rethrowWithResponseHeaders, returnRenderResponse } from '../utils/renderer/app'
import { getSSRRenderer } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { getClientIslandResponse, getServerComponentHTML, getSlotIslandResponse } from '../utils/renderer/islands'
import { patchDevClientCss } from '../utils/renderer/dev-css'
import { recordDevClientCss } from '../utils/renderer/dev-client-css'
import { useStorage } from 'nitro/storage'
import type { Storage } from 'unstorage'

export const islandCache: Storage<NuxtIslandResponse> | null = import.meta.prerender ? useStorage<NuxtIslandResponse>('internal:nuxt:prerender:island') : null
export const islandPropCache: Storage<string> | null = import.meta.prerender ? useStorage<string>('internal:nuxt:prerender:island-props') : null

const ISLAND_SUFFIX_RE = /\.json(?:\?.*)?$/

// Prerendering fetches the same island from every page that embeds it, so
// without this those renders race to write the same cache entry.
const inFlightIslands: Map<string, Promise<NuxtIslandResponse>> | null = import.meta.prerender ? new Map() : null

export default {
  async fetch (request: Request): Promise<Response> {
    const event = new H3Event(request)
    const islandPath = event.url.pathname
    let inFlight: Promise<NuxtIslandResponse> | undefined
    let resolveIsland: ((response: NuxtIslandResponse) => void) | undefined
    let rejectIsland: ((reason: unknown) => void) | undefined
    try {
      event.res.headers.set('content-type', 'application/json;charset=utf-8')
      event.res.headers.set('x-powered-by', 'Nuxt')

      if (import.meta.prerender) {
        let pending = inFlightIslands!.get(islandPath)
        while (pending) {
          // same result as a cache hit, hooks included
          const islandResponse = await pending.catch(() => null)
          if (islandResponse) {
            return new FastResponse(JSON.stringify(islandResponse), event.res)
          }
          // that render failed: follow whoever claimed it next instead of
          // every waiter starting its own
          const next = inFlightIslands!.get(islandPath)
          if (!next || next === pending) {
            break
          }
          pending = next
        }
        // set before the first `await`, or a concurrent request slips past
        inFlight = new Promise<NuxtIslandResponse>((resolve, reject) => {
          resolveIsland = resolve
          rejectIsland = reject
        })
        inFlight.catch(() => {})
        inFlightIslands!.set(islandPath, inFlight)
      }

      if (import.meta.prerender && await islandCache!.hasItem(islandPath)) {
        const cached = await islandCache!.getItem(islandPath)
        if (cached) {
          resolveIsland?.(cached)
          return new FastResponse(JSON.stringify(cached), event.res)
        }
      }

      const islandContext = await getIslandContext(event)

      const ssrContext = {
        ...createSSRContext(event),
        islandContext,
        noSSR: false,
        url: islandContext.url,
      }

      // Render app
      const renderer = await getSSRRenderer()

      const renderResult = await (tracingChannelNuxt
        ? traceAsync('nuxt.island', { event, ssrContext, islandContext }, () => renderer.renderToString(ssrContext))
        : renderer.renderToString(ssrContext)
      ).catch(async (err) => {
        if (ssrContext['~renderResponse'] && (err as Error)?.message === 'skipping render') {
          return {} as Awaited<ReturnType<typeof renderer.renderToString>>
        }
        await ssrContext.nuxt?.hooks.callHook('app:error', err)
        throw err
      })

      // Fire `app:rendered` before checking `~renderResponse` (matches `renderer.ts`), so
      // anything hooking into it, like `useCookie`, will still work on redirect/reject.
      await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult })

      if (ssrContext['~renderResponse']) {
        // not shareable: it carries this request's own response
        rejectIsland?.(new Error('island rendered a raw response'))
        return returnRenderResponse(event, ssrContext['~renderResponse'])
      }

      // Handle errors
      if (ssrContext.payload?.error) {
        throw ssrContext.payload.error
      }

      const inlinedStyles = await renderInlineStyles(ssrContext.modules ?? [])

      if (inlinedStyles.length) {
        ssrContext.head.push({ style: inlinedStyles })
      }

      if (import.meta.dev) {
        // refresh  per-request CSS from the builder's module graph post-render
        await recordDevClientCss(event)
        // ... and patch it into the manifest.
        patchDevClientCss(event, renderer.rendererContext)
        const { styles } = getRequestDependencies(ssrContext, renderer.rendererContext)

        const link: Link[] = []
        for (const resource of Object.values(styles)) {
          // Do not add links to resources that are inlined (vite v5+)
          if ('inline' in getURLQuery(resource.file)) {
            continue
          }
          // Add CSS links in <head> for CSS files
          // - in dev mode when rendering an island and the file has scoped styles and is not a page
          if (resource.file.includes('scoped') && !resource.file.includes('pages/')) {
            link.push({ rel: 'stylesheet', href: renderer.rendererContext.buildAssetsURL(resource.file), crossorigin: '' })
          }
        }
        if (link.length) {
          ssrContext.head.push({ link })
        }
      }

      const islandHead: SerializableHead = {}
      for (const entry of ssrContext.head.entries.values()) {
        for (const [key, value] of Object.entries(walkResolver(entry.input, VueResolver) as SerializableHead)) {
          const currentValue = islandHead[key as keyof SerializableHead]
          if (Array.isArray(currentValue)) {
            currentValue.push(...value)
          } else {
            islandHead[key as keyof SerializableHead] = value
          }
        }
      }

      const islandResponse: NuxtIslandResponse = {
        id: islandContext.id,
        head: islandHead,
        html: getServerComponentHTML(renderResult.html),
        components: getClientIslandResponse(ssrContext),
        slots: getSlotIslandResponse(ssrContext),
      }

      await useNitroHooks().callHook('render:island', islandResponse, { event, islandContext })

      resolveIsland?.(islandResponse)

      if (import.meta.prerender) {
        const requestUrl = islandPath + event.url.search + event.url.hash
        // independent: without the props entry a later request for the bare
        // path hashes empty props and is rejected
        await islandCache!.setItem(islandPath, islandResponse).catch(warnCacheFailure)
        await islandPropCache!.setItem(islandPath, requestUrl).catch(warnCacheFailure)
      }
      return new FastResponse(JSON.stringify(islandResponse), event.res)
    } catch (error) {
      rejectIsland?.(error)
      rethrowWithResponseHeaders(event, error)
    } finally {
      // only the render that claimed it may retire it, or a waiter returning
      // early reopens the race
      if (inFlight && inFlightIslands?.get(islandPath) === inFlight) {
        inFlightIslands.delete(islandPath)
      }
    }
  },
}

function warnCacheFailure (error: unknown) {
  console.warn('[nuxt] could not cache island render:', error)
}

const ISLAND_PATH_PREFIX = '/__nuxt_island/'
const VALID_COMPONENT_NAME_RE = /^[a-z][\w.-]*$/i

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  let url = event.url.pathname + event.url.search + event.url.hash
  const islandPath = event.url.pathname
  if (import.meta.prerender && await islandPropCache!.hasItem(islandPath)) {
    // for prerender, the original request URL (with query) is rehydrated from cache
    // so that re-renders of the same island path use the original props
    url = await islandPropCache!.getItem(islandPath) as string
  }

  if (!url.startsWith(ISLAND_PATH_PREFIX)) {
    throw new HTTPError({ status: 400, statusText: 'Invalid island request path' })
  }

  const componentParts = url.substring(ISLAND_PATH_PREFIX.length).replace(ISLAND_SUFFIX_RE, '').split('_')
  const hashId = componentParts.length > 1 ? componentParts.pop() : undefined
  const componentName = componentParts.join('_')

  if (!componentName || !VALID_COMPONENT_NAME_RE.test(componentName)) {
    throw new HTTPError({ status: 400, statusText: 'Invalid island component name' })
  }

  const rawContext = event.req.method === 'GET' ? getQuery<NuxtIslandContext>(event) : await readBody<NuxtIslandContext>(event)
  const serializedProps = typeof rawContext?.props === 'string' ? rawContext.props : '{}'

  // Reconstruct the `context` object as the client computed its hash over.
  // `<NuxtIsland>` sends `{ ...props.context, props: serializedProps }`
  const clientContext: Record<string, any> = {}
  if (rawContext && typeof rawContext === 'object') {
    for (const key in rawContext) {
      if (key !== 'props') {
        clientContext[key] = (rawContext as Record<string, any>)[key]
      }
    }
  }

  // Bind the response to the URL: a request whose URL-resident `hashId` does not match
  // the actual (name, serialized props, context) is rejected.
  const expectedHash = getIslandHash({ name: componentName, props: serializedProps, context: clientContext })
  if (!hashId || hashId !== expectedHash) {
    throw new HTTPError({ status: 400, statusText: 'Invalid island request hash' })
  }

  const parsedProps = destr<Record<string, any> | null | undefined>(serializedProps) || {}

  return {
    url: typeof rawContext?.url === 'string' ? rawContext.url : '/',
    id: hashId,
    name: componentName,
    props: parsedProps,
    slots: {},
    components: {},
  }
}
