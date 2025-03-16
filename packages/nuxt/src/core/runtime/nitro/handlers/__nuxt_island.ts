import { defineRenderHandler, useNitroApp } from 'nitro/runtime'
import type { RenderResponse } from 'nitro/types'
import type { SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { H3Event } from 'h3'
import { getQuery, getResponseStatus, getResponseStatusText, readBody } from 'h3'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { islandCache, islandPropCache } from '../utils/cache'
import { createSSRContext } from '../utils/renderer/app'
import { getRenderer } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { type NuxtIslandContext, type NuxtIslandResponse, getClientIslandResponse, getServerComponentHTML, getSlotIslandResponse } from '../utils/renderer/islands'

const ISLAND_SUFFIX_RE = /\.json(\?.*)?$/

// todo register event handler into nitro
export default defineRenderHandler(async (event) => {
  const nitroApp = useNitroApp()
  // todo change event url

  if (import.meta.prerender && event.path && await islandCache!.hasItem(event.path)) {
    return islandCache!.getItem(event.path) as Promise<Partial<RenderResponse>>
  }

  const ssrContext = createSSRContext(event)
  const islandContext = ssrContext.islandContext = await getIslandContext(event)

  // Render app
  const renderer = await getRenderer(ssrContext)

  const renderResult = await renderer.renderToString(ssrContext).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make

    // _renderResponse is set in navigateTo() ... should we keep it ?
    // if (ssrContext._renderResponse && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    await ssrContext.nuxt?.hooks.callHook('app:error', error)
    throw error
  })

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult })

  const inlinedStyles = await renderInlineStyles(ssrContext.modules ?? [])

  if (inlinedStyles.length) {
    ssrContext.head.push({ style: inlinedStyles })
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

  const response = {
    body: JSON.stringify(islandResponse, null, 2),
    statusCode: getResponseStatus(event),
    statusMessage: getResponseStatusText(event),
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  }
  if (import.meta.prerender) {
    await islandCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}.json`, response)
    await islandPropCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}.json`, event.path)
  }
  return response
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
