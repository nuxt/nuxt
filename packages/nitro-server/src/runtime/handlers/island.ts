import { useNitroApp } from 'nitropack/runtime'
import type { RenderResponse } from 'nitropack/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { EventHandler, H3Event } from 'h3'
import { createError, defineEventHandler, getQuery, readBody, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'
import { VueResolver, walkResolver } from '@unhead/vue/utils'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { computeIslandHash } from '#app/island-hash'
import type { NuxtIslandContext, NuxtIslandResponse } from 'nuxt/app'
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

  const rawContext = event.method === 'GET' ? getQuery<NuxtIslandContext>(event) : await readBody<NuxtIslandContext>(event)
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
    throw createError({ statusCode: 400, statusMessage: 'Invalid island request hash' })
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
