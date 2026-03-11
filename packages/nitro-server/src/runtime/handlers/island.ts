import { useNitroApp } from 'nitropack/runtime'
import type { RenderResponse } from 'nitropack/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { EventHandler, H3Event } from 'h3'
import { createError, defineEventHandler, getQuery, readBody, setResponseHeaders } from 'h3'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
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
    await ssrContext.nuxt?.hooks.callHook('app:error', err)
    throw err
  })

  // Handle errors
  if (ssrContext.payload?.error) {
    throw ssrContext.payload.error
  }

  const inlinedStyles = await renderInlineStyles(ssrContext.modules ?? [])

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult })

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

const ISLAND_PATH_PREFIX = '/__nuxt_island/'
const VALID_COMPONENT_NAME_RE = /^[a-z][\w.-]*$/i

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  let url = event.path || ''
  if (import.meta.prerender && event.path && await islandPropCache!.hasItem(event.path)) {
    // rehydrate props from cache so we can rerender island if cache does not have it any more
    url = await islandPropCache!.getItem(event.path) as string
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

  const context = event.method === 'GET' ? getQuery(event) : await readBody(event)

  // Only extract known context fields to prevent arbitrary data injection
  return {
    url: typeof context.url === 'string' ? context.url : '/',
    id: hashId,
    name: componentName,
    props: destr(context.props) || {},
    slots: {},
    components: {},
  }
}
