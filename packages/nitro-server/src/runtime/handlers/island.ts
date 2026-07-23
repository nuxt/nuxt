import type { RenderResponse } from 'nitropack/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { EventHandler, H3Event } from 'h3'
import { createError, defineEventHandler, getQuery, getRequestHeader, getRequestWebStream, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { computeIslandHash } from '#app/island-hash'
// @ts-expect-error virtual file
import { runtimeCompiler } from '#internal/nuxt.config.mjs'
import { findUnsafeIslandPropKey } from '#app/island-props'
import { MAX_ISLAND_BODY_BYTES, exceedsMaxBytes, exceedsMaxDepth } from '../utils/island-props'
import type { NuxtIslandContext, NuxtIslandResponse } from 'nuxt/app'
import { useNitroApp } from 'nitropack/runtime/app'

import { islandCache, islandPropCache } from '../utils/cache'
import { createSSRContext } from '../utils/renderer/app'
import { getSSRRenderer } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { getClientIslandResponse, getServerComponentHTML, getSlotIslandResponse } from '../utils/renderer/islands'

const ISLAND_SUFFIX_RE = /\.json(?:\?.*)?$/

const handler: EventHandler = defineEventHandler(async (event) => {
  const nitroApp = useNitroApp()

  setResponseHeaders(event, {
    'content-type': 'application/json;charset=utf-8',
    'x-powered-by': 'Nuxt',
  })

  if (import.meta.prerender && event.path && await islandCache!.hasItem(event.path)) {
    return islandCache!.getItem(event.path) as Promise<Partial<RenderResponse>>
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

  const renderResult = await renderer.renderToString(ssrContext).catch(async (err) => {
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
    const response = ssrContext['~renderResponse']
    if (response.statusCode && response.statusCode >= 400) {
      throw createError({
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
      })
    }
    return returnIslandResponse(event, response)
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
      ssrContext.head.push({ link }, { mode: 'server' })
    }
  }

  const islandHead: SerializableHead = {}
  for (const entry of ssrContext.head.entries.values()) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    for (const [key, value] of Object.entries(resolveUnrefHeadInput(entry.input as any) as SerializableHead)) {
      const currentValue = islandHead[key as keyof SerializableHead]
      if (Array.isArray(currentValue)) {
        currentValue.push(...value)
      } else {
        islandHead[key as keyof SerializableHead] = value
      }
    }
  }

  // TODO: remove for v4
  islandHead.link ||= []
  islandHead.style ||= []

  const islandResponse: NuxtIslandResponse = {
    id: islandContext.id,
    head: islandHead,
    html: getServerComponentHTML(renderResult.html),
    components: getClientIslandResponse(ssrContext),
    slots: getSlotIslandResponse(ssrContext),
  }

  await nitroApp.hooks.callHook('render:island', islandResponse, { event, islandContext })

  if (import.meta.prerender) {
    await islandCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}.json`, islandResponse)
    await islandPropCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}.json`, event.path)
  }
  return islandResponse
})

export default handler

function returnIslandResponse (event: H3Event, response: Partial<RenderResponse>) {
  for (const header in response.headers || {}) {
    setResponseHeader(event, header, response.headers![header]!)
  }
  if (response.statusCode) {
    setResponseStatus(event, response.statusCode, response.statusMessage)
  }
  return response.body
}

const ISLAND_PATH_PREFIX = '/__nuxt_island/'
const VALID_COMPONENT_NAME_RE = /^[a-z][\w.-]*$/i

// Read a non-GET island body, refusing oversized or deeply nested input before the JSON
// parse and hash run on it.
async function readGuardedIslandBody (event: H3Event): Promise<NuxtIslandContext> {
  const contentLength = Number(getRequestHeader(event, 'content-length'))
  if (contentLength > MAX_ISLAND_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Island request body too large' })
  }

  // Stream with a running byte count rather than buffering: a chunked request carries no
  // `content-length`, so the header check alone can't bound an unbounded body.
  let received = 0
  let raw = ''
  let overflowed = false
  const stream = getRequestWebStream(event)
  if (stream) {
    const decoder = new TextDecoder()
    const reader = (stream as ReadableStream<Uint8Array>).getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) { break }
        received += value.byteLength
        if (received > MAX_ISLAND_BODY_BYTES) {
          // Stop buffering (memory stays bounded) but keep draining so the request is fully
          // consumed: bailing out mid-upload resets the socket and poisons connection reuse
          // for the next request on the same keep-alive connection.
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
  const islandPath = url.replace(/\?.*$/, '')
  if (import.meta.prerender && event.path && await islandPropCache!.hasItem(islandPath)) {
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

  const parsedProps = destr<Record<string, any> | null | undefined>(serializedProps) || {}

  // Bind the response to the URL: a request whose URL-resident `hashId` does not match
  // the actual (name, serialized props, context) is rejected.
  const expectedHash = computeIslandHash(componentName, serializedProps, clientContext, undefined)
  if (!hashId || hashId !== expectedHash) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request hash' })
  }

  // A `template` prop is only executable with the runtime compiler bundled, so this reject
  // (which would otherwise trip on legitimate data keyed `template`) is scoped to it.
  if (runtimeCompiler && findUnsafeIslandPropKey(parsedProps)) {
    // The detail goes to the server console; echoing it would confirm to an unauthenticated
    // caller that the runtime compiler is bundled.
    if (import.meta.dev) {
      console.warn('Island props cannot contain a `template` key, which the Vue runtime compiler would compile and execute. Rename the prop, or disable `vue.runtimeCompiler`.')
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
