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
import { prerenderRenderingURLs } from '../utils/cache'
import { useStorage } from 'nitro/storage'
import type { Storage } from 'unstorage'

export const islandCache: Storage<NuxtIslandResponse> | null = import.meta.prerender ? useStorage<NuxtIslandResponse>('internal:nuxt:prerender:island') : null
export const islandPropCache: Storage<string> | null = import.meta.prerender ? useStorage<string>('internal:nuxt:prerender:island-props') : null

const ISLAND_SUFFIX_RE = /\.json(?:\?.*)?$/
const ISLAND_PATH_PREFIX = '/__nuxt_island/'

/** A render that produced a `Response` of its own (redirect, abort, ...), which is bound to the request that made it. */
interface RawIslandResponse { raw: Response }

type IslandRenderResult = NuxtIslandResponse | RawIslandResponse

/**
 * Renders in flight, keyed by island path. Prerendering requests the same island from
 * every page that embeds it, so without this those renders duplicate work and race to
 * write the same cache entry (which fails the build with `EPERM` on Windows).
 */
const inFlightIslands: Map<string, Promise<IslandRenderResult>> | null = import.meta.prerender ? new Map() : null

export default {
  async fetch (request: Request): Promise<Response> {
    const event = new H3Event(request)
    try {
      event.res.headers.set('content-type', 'application/json;charset=utf-8')
      event.res.headers.set('x-powered-by', 'Nuxt')

      if (!import.meta.prerender) {
        return toResponse(event, await renderIsland(event))
      }

      const islandPath = event.url.pathname
      const stack = prerenderRenderingURLs!.getStore()
      if (stack?.includes(islandPath)) {
        const chain = [...stack, islandPath].map(url => `"${url}"`).join(' -> ')
        throw new HTTPError({
          status: 508,
          statusText: `Loop detected while prerendering island "${islandPath}" (${chain}).`,
        })
      }

      // Only a render holding no claim of its own may wait on another, or two nested
      // island renders could end up awaiting each other's claim and hang the build.
      if (!stack?.some(url => url.startsWith(ISLAND_PATH_PREFIX))) {
        // A raw response belongs to the request that produced it, so it cannot be shared;
        // fall through and render our own.
        const shared = await inFlightIslands!.get(islandPath)
        if (shared && !('raw' in shared)) {
          return toResponse(event, shared)
        }
      }

      return toResponse(event, await prerenderIsland(event, islandPath))
    } catch (error) {
      rethrowWithResponseHeaders(event, error)
    }
  },
}

function toResponse (event: H3Event, result: IslandRenderResult): Response {
  return 'raw' in result
    ? returnRenderResponse(event, result.raw)
    : new FastResponse(JSON.stringify(result), event.res)
}

function prerenderIsland (event: H3Event, islandPath: string): Promise<IslandRenderResult> {
  const stack = prerenderRenderingURLs!.getStore()
  const promise: Promise<IslandRenderResult> = prerenderRenderingURLs!.run([...(stack || []), islandPath], async () => {
    const cached = await islandCache!.getItem(islandPath)
    if (cached) {
      return cached
    }

    const result = await renderIsland(event)
    if (!('raw' in result)) {
      await islandCache!.setItem(islandPath, result)
      // Without the props entry, a later request for the bare path hashes empty props and is rejected.
      await islandPropCache!.setItem(islandPath, islandPath + event.url.search + event.url.hash)
    }
    return result
  }).finally(() => {
    // a waiter that received a raw response claims the path while we are still
    // registered, so only retire our own entry
    if (inFlightIslands!.get(islandPath) === promise) {
      inFlightIslands!.delete(islandPath)
    }
  })

  inFlightIslands!.set(islandPath, promise)

  return promise
}

async function renderIsland (event: H3Event): Promise<IslandRenderResult> {
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
    return { raw: ssrContext['~renderResponse'] }
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

  return islandResponse
}

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
