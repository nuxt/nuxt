import { useNitroHooks } from 'nitro/app'
import type { RenderResponse } from 'nitro/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { H3Event } from 'nitro/h3'
import { HTTPError, defineEventHandler, getQuery, readBody } from 'nitro/h3'
import { VueResolver, walkResolver } from '@unhead/vue/utils'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { computeIslandHash } from '#app/island-hash'
import type { NuxtIslandContext, NuxtIslandResponse } from 'nuxt/app'
import { traceAsync } from '#app/internal/tracing'
// @ts-expect-error virtual file
import { tracingChannelNuxt } from '#internal/nuxt.config.mjs'
import { islandCache, islandPropCache } from '../utils/cache'
import { clearVueCurrentInstance, createSSRContext } from '../utils/renderer/app'
import { getSSRRenderer } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { getClientIslandResponse, getServerComponentHTML, getSlotIslandResponse } from '../utils/renderer/islands'

const ISLAND_SUFFIX_RE = /\.json(?:\?.*)?$/

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler(async (event) => {
  event.res.headers.set('content-type', 'application/json;charset=utf-8')
  event.res.headers.set('x-powered-by', 'Nuxt')

  const islandPath = event.url.pathname
  if (import.meta.prerender && await islandCache!.hasItem(islandPath)) {
    return islandCache!.getItem(islandPath) as Promise<Partial<RenderResponse>>
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
  }).finally(() => {
    clearVueCurrentInstance()
  })

  // Fire `app:rendered` before checking `~renderResponse` (matches `renderer.ts`), so
  // anything hooking into it, like `useCookie`, will still work on redirect/reject.
  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult })

  if (ssrContext['~renderResponse']) {
    const response = ssrContext['~renderResponse']
    if (response.status && response.status >= 400) {
      throw new HTTPError({
        status: response.status,
        statusText: response.statusText,
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

  if (import.meta.prerender) {
    const requestUrl = islandPath + event.url.search + event.url.hash
    await islandCache!.setItem(islandPath, islandResponse)
    await islandPropCache!.setItem(islandPath, requestUrl)
  }
  return islandResponse
})

export default handler

function returnIslandResponse (event: H3Event, response: Partial<RenderResponse>) {
  for (const header in response.headers || {}) {
    event.res.headers.set(header, response.headers![header]!)
  }
  if (response.status) {
    event.res.status = response.status
  }
  if (response.statusText) {
    event.res.statusText = response.statusText
  }
  return response.body
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
  const expectedHash = computeIslandHash(componentName, serializedProps, clientContext, undefined)
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
