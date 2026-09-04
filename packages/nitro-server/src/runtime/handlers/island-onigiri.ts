import { useNitroApp } from 'nitropack/runtime'
import type { RenderResponse } from 'nitropack/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { EventHandler, H3Event } from 'h3'
import { createError, defineEventHandler, getQuery, getRequestWebStream, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'
import { VueResolver, walkResolver } from '@unhead/vue/utils'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { serializeApp } from 'vue-onigiri/runtime/serialize'
import { defineComponent, getCurrentInstance, h } from 'vue'
import type { Component } from 'vue'
import { filterIslandProps, getIslandHash } from '#app/island-hash'
import { findReservedRootIslandPropKey, findUnsafeIslandPropKey } from '#app/island-props'
import { renderDiagnostics } from '#app/diagnostics/render'
import type { NuxtIslandContext, NuxtIslandResponse } from '#app/types'
import { traceAsync } from '#app/internal/tracing'
import { runtimeCompiler, tracingChannelNuxt } from '#internal/nuxt.config.mjs'
import { serverDiagnostics } from '../diagnostics'
import { MAX_ISLAND_BODY_BYTES, exceedsMaxBytes, exceedsMaxDepth } from '../utils/island-props'
import { islandCache, islandPropCache, prerenderRenderingURLs } from '../utils/cache'
import { createSSRContext } from '../utils/renderer/app'
import { getSSRRenderer, getServerEntry } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'

// @ts-expect-error file will be produced after app build
const getComponentsIslands = () => import('#build/dist/server/components.islands.mjs').then(r => typeof r.default === 'function' ? r.default() : r)

type IslandsModule = Awaited<ReturnType<typeof getComponentsIslands>>

let _islandsPromise: Promise<IslandsModule> | undefined
function getIslands (): Promise<IslandsModule> {
  _islandsPromise ||= getComponentsIslands()
  return _islandsPromise
}

const PAGE_ISLAND_PREFIX = 'page_'

function createPageIslandRoot (name: string, islands: IslandsModule) {
  return defineComponent({
    name: 'PageIslandRoot',
    inheritAttrs: false,
    setup (_, { attrs }) {
      const route = getCurrentInstance()!.appContext.config.globalProperties.$route
      islands.providePageIslandDepth(route, islands.pageIslandRoutes[name])
      return () => h(islands.islandComponents[name], attrs)
    },
  })
}

const ISLAND_SUFFIX_RE = /\.json(?:\?.*)?$/
const ISLAND_PATH_PREFIX = '/__nuxt_island/'

/** A response produced by the render itself (redirect, abort, ...), bound to the request that made it. */
interface RawIslandResponse { raw: Partial<RenderResponse> }

type IslandRenderResult = NuxtIslandResponse | RawIslandResponse

/**
 * Renders in flight, keyed by island path, so that pages prerendered in parallel share a
 * single render of an island they both embed instead of racing to write its cache entry
 * (which fails the build with `EPERM` on Windows).
 */
const inFlightIslands: Map<string, Promise<IslandRenderResult>> | null = import.meta.prerender ? new Map() : null

const handler: EventHandler = defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'content-type': 'application/json;charset=utf-8',
    'x-powered-by': 'Nuxt',
  })

  if (!import.meta.prerender) {
    return toResponse(event, await renderIsland(event))
  }

  const islandPath = getIslandPath(event)
  const stack = prerenderRenderingURLs!.getStore()
  if (stack?.includes(islandPath)) {
    const chain = [...stack, islandPath].map(url => `"${url}"`).join(' -> ')
    throw createError({
      statusCode: 508,
      statusMessage: `Loop detected while prerendering island "${islandPath}" (${chain}).`,
    })
  }

  // Only a render holding no claim of its own may wait on another, or two nested island
  // renders could await each other's claim and hang the build.
  const inFlight = stack?.some(url => url.startsWith(ISLAND_PATH_PREFIX)) ? undefined : inFlightIslands!.get(islandPath)
  if (inFlight) {
    const shared = await inFlight.catch((error: any) => {
      // the shared error is bound to the request that produced it, so rethrow a copy
      throw createError({ statusCode: error?.statusCode, statusMessage: error?.statusMessage, message: error?.message, cause: error })
    })
    // a raw response cannot be shared, so fall through and render our own
    if (!('raw' in shared)) {
      return toResponse(event, shared)
    }
  }

  // No await between the lookup above and the claim inside `prerenderIsland`: pages
  // prerendered in parallel request the same island in the same tick, and a gap here
  // lets both miss the map and race on the cache write.
  return toResponse(event, await prerenderIsland(event, islandPath))
})

export default handler

function getIslandPath (event: H3Event): string {
  return (event.path || '').replace(/\?.*$/, '')
}

function toResponse (event: H3Event, result: IslandRenderResult) {
  if (!('raw' in result)) {
    return result
  }
  for (const header in result.raw.headers || {}) {
    setResponseHeader(event, header, result.raw.headers![header]!)
  }
  if (result.raw.statusCode) {
    setResponseStatus(event, result.raw.statusCode, result.raw.statusMessage)
  }
  return result.raw.body
}

function prerenderIsland (event: H3Event, islandPath: string): Promise<IslandRenderResult> {
  const stack = prerenderRenderingURLs!.getStore()
  const promise: Promise<IslandRenderResult> = prerenderRenderingURLs!.run([...(stack || []), islandPath], async () => {
    const cached = await islandCache!.getItem(islandPath) as NuxtIslandResponse | null
    if (cached) {
      return cached
    }

    const result = await renderIsland(event)
    if (!('raw' in result)) {
      await islandCache!.setItem(islandPath, result)
      // without the props entry, a later request for the bare path hashes empty props and is rejected
      await islandPropCache!.setItem(islandPath, event.path)
    }
    return result
  }).finally(() => {
    // a waiter that received a raw response can claim the path while we are still
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

  const createSSRApp = await getServerEntry()

  // Pin the SSR app's root to the requested island component so
  // `serializeApp` produces the island's AST (not the wrapping app
  // shell). Resolved via the build-time `components.islands.mjs` map.
  const islands = await getIslands()
  if (!Object.hasOwn(islands.islandComponents, islandContext.name)) {
    throw createError({
      statusCode: 404,
      statusMessage: `Island component not found: ${islandContext.name}`,
    })
  }
  const islandComponent = islands.islandComponents[islandContext.name] as Component

  const loader = (islandComponent as { __asyncLoader?: () => Promise<Component> }).__asyncLoader
  const reservedKey = findReservedRootIslandPropKey(islandContext.props, loader ? await loader() : islandComponent)
  if (reservedKey) {
    // The detail goes to the server console; the response carries a fixed reason so it
    // cannot be used to probe which islands declare which props.
    if (import.meta.dev) {
      renderDiagnostics.NUXT_E4018({ name: islandContext.name, key: reservedKey })
    }
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request props' })
  }

  const rootComponent = islandContext.name.startsWith(PAGE_ISLAND_PREFIX)
    ? createPageIslandRoot(islandContext.name, islands)
    : islandComponent

  let renderError: unknown
  const ast = await (async () => {
    // `createSSRApp` runs plugins (and so router middleware), which can abort the render
    // the same way the serializer can, so it shares the `skipping render` catch below.
    const app = await createSSRApp(ssrContext, { rootComponent })
    app.config.errorHandler ||= (error) => { renderError ||= error }
    return tracingChannelNuxt
      ? traceAsync('nuxt.island', { event, ssrContext, islandContext }, () => app.runWithContext(() => serializeApp(app, undefined, ssrContext)))
      : app.runWithContext(() => serializeApp(app, undefined, ssrContext))
  })().catch(async (err: unknown) => {
    if (ssrContext['~renderResponse'] && (err as Error)?.message === 'skipping render') {
      return undefined
    }
    await ssrContext.nuxt?.hooks.callHook('app:error', err)
    throw err
  })

  // Fire `app:rendered` before checking `~renderResponse` (matches `renderer.ts`), so
  // anything hooking into it, like `useCookie`, will still work on redirect/reject.
  // The onigiri island path serializes the app to an AST rather than rendering
  // HTML, so there is no `renderResult` to report.
  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: null })

  if (ssrContext['~renderResponse']) {
    const response = ssrContext['~renderResponse']
    if (response.statusCode && response.statusCode >= 400) {
      throw createError({
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
      })
    }
    return { raw: response }
  }

  // Handle errors
  if (ssrContext.payload?.error) {
    throw ssrContext.payload.error
  }
  if (renderError) {
    if (import.meta.dev) {
      renderDiagnostics.NUXT_E4015({ name: islandContext.name })
    }
    await ssrContext.nuxt?.hooks.callHook('app:error', renderError)
    throw renderError
  }

  const inlinedStyles = await renderInlineStyles(ssrContext.modules ?? [])

  if (inlinedStyles.length) {
    ssrContext.head.push({ style: inlinedStyles })
  }

  if (import.meta.dev) {
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
    ast,
  }

  await useNitroApp().hooks.callHook('render:island', islandResponse, { event, islandContext })

  return islandResponse
}

const VALID_COMPONENT_NAME_RE = /^[a-z][\w.-]*$/i

// Read a non-GET island body, refusing oversized or deeply nested input before the JSON
// parse and hash run on it.
async function readGuardedIslandBody (event: H3Event): Promise<NuxtIslandContext> {
  let overflowed = Number(event.headers.get('content-length')) > MAX_ISLAND_BODY_BYTES

  // Stream with a running byte count rather than buffering: a chunked request carries no
  // `content-length`, so the header check alone can't bound an unbounded body.
  let received = 0
  let raw = ''
  const stream = getRequestWebStream(event)
  if (stream) {
    const decoder = new TextDecoder()
    // Read through a reader rather than `for await`: async iteration of a `ReadableStream` is
    // a runtime extension, not part of the stream spec, so it is absent on some deploy targets.
    const reader = stream.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) { break }
        received += value.byteLength
        if (overflowed || received > MAX_ISLAND_BODY_BYTES) {
          overflowed = true
          continue
        }
        raw += decoder.decode(value, { stream: true })
      }
    } finally {
      reader.releaseLock()
    }
    raw += decoder.decode()
  }
  if (overflowed) {
    throw createError({ statusCode: 413, statusMessage: 'Island request body too large' })
  }
  if (!raw) {
    return {} as NuxtIslandContext
  }
  if (exceedsMaxDepth(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Island request body too deeply nested' })
  }

  return destr<NuxtIslandContext>(raw) || {} as NuxtIslandContext
}

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  let url = event.path || ''
  const islandPath = getIslandPath(event)
  if (import.meta.prerender && await islandPropCache!.hasItem(islandPath)) {
    // for prerender, the original request URL (with query) is rehydrated from cache
    // so that re-renders of the same island path use the original props
    url = await islandPropCache!.getItem(islandPath) as string
  }

  if (!url.startsWith(ISLAND_PATH_PREFIX)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request path' })
  }

  const componentParts = url.substring(ISLAND_PATH_PREFIX.length).replace(ISLAND_SUFFIX_RE, '').split('_')
  const hashId = componentParts.length > 1 ? componentParts.pop() : undefined
  const componentName = componentParts.join('_')

  if (!componentName || !VALID_COMPONENT_NAME_RE.test(componentName)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid island component name' })
  }

  const rawContext = event.method === 'GET' ? getQuery<NuxtIslandContext>(event) : await readGuardedIslandBody(event)
  const serializedProps = typeof rawContext?.props === 'string' ? rawContext.props : '{}'

  // Bound the props string before parsing/hashing (GET carries them in the query, not the
  // guarded body).
  if (exceedsMaxBytes(serializedProps)) {
    throw createError({ statusCode: 413, statusMessage: 'Island request props too large' })
  }
  if (exceedsMaxDepth(serializedProps)) {
    throw createError({ statusCode: 400, statusMessage: 'Island request props too deeply nested' })
  }

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

  // Strip `data-v-*` scoped-style markers so the hashed and rendered prop sets match.
  const parsed = destr(serializedProps)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request props' })
  }
  const parsedProps = filterIslandProps(parsed)

  // Bind the response to the URL: a request whose URL-resident `hashId` does not match
  // the actual (name, props, context) is rejected.
  const expectedHash = getIslandHash({ name: componentName, props: parsedProps, context: clientContext })
  if (!hashId || hashId !== expectedHash) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request hash' })
  }

  // A `template` prop is only executable with the runtime compiler bundled, so this reject
  // (which would otherwise trip on legitimate data keyed `template`) is scoped to it.
  if (runtimeCompiler && findUnsafeIslandPropKey(parsedProps)) {
    // The detail goes to the server console; echoing it would confirm to an unauthenticated
    // caller that the runtime compiler is bundled.
    if (import.meta.dev) {
      serverDiagnostics.NUXT_E8005()
    }
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request props' })
  }

  return {
    url: typeof rawContext?.url === 'string' ? rawContext.url : '/',
    id: hashId,
    name: componentName,
    props: parsedProps,
    slots: {},
    components: {},
  }
}
