import { useNitroApp } from 'nitro/runtime'
import type { RenderResponse } from 'nitro/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { H3Event } from 'h3'
import { defineEventHandler, getQuery, readBody, setResponseHeaders } from 'h3'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { islandCache, islandPropCache } from '../utils/cache'
import { createSSRContext } from '../utils/renderer/app'
import { getSSRRenderer } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { type NuxtIslandContext, type NuxtIslandResponse, getClientIslandResponse, getServerComponentHTML, getSlotIslandResponse } from '../utils/renderer/islands'

const ISLAND_SUFFIX_RE = /\.json(\?.*)?$/

export default defineEventHandler(async (event) => {
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

  const renderResult = await renderer.renderToString(ssrContext).catch(async (error) => {
    await ssrContext.nuxt?.hooks.callHook('app:error', error)
    throw error
  })

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
    for (const [key, value] of Object.entries(resolveUnrefHeadInput(entry.input as any) as SerializableHead)) {
      const currentValue = islandHead[key as keyof SerializableHead]
      if (Array.isArray(currentValue)) {
        currentValue.push(...value)
      }
      islandHead[key as keyof SerializableHead] = value
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

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  // TODO: Strict validation for url
  let url = event.path || ''
  if (import.meta.prerender && event.path && await islandPropCache!.hasItem(event.path)) {
    // rehydrate props from cache so we can rerender island if cache does not have it any more
    url = await islandPropCache!.getItem(event.path) as string
  }
  const componentParts = url.substring('/__nuxt_island'.length + 1).replace(ISLAND_SUFFIX_RE, '').split('_')
  const hashId = componentParts.length > 1 ? componentParts.pop() : undefined
  const componentName = componentParts.join('_')

  // TODO: Validate context
  const context = event.method === 'GET' ? getQuery(event) : await readBody(event)

  const ctx: NuxtIslandContext = {
    url: '/',
    ...context,
    id: hashId,
    name: componentName,
    props: destr(context.props) || {},
    slots: {},
    components: {},
  }

  return ctx
}
