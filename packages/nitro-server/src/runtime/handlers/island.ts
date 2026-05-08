import { useNitroHooks } from 'nitro/app'
import type { RenderResponse } from 'nitro/types'
import type { Link, SerializableHead } from '@unhead/vue/types'
import { destr } from 'destr'
import type { H3Event } from 'nitro/h3'
import { HTTPError, defineEventHandler, getQuery, readBody } from 'nitro/h3'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { getRequestDependencies } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery } from 'ufo'
import { serializeApp } from 'vue-onigiri/runtime/serialize'
import type { NuxtIslandContext, NuxtIslandResponse } from 'nuxt/app'
import { islandCache, islandPropCache } from '../utils/cache'
import { createSSRContext } from '../utils/renderer/app'
import { getComponentsIslands, getSSRRenderer, getServerEntry } from '../utils/renderer/build-files'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { getClientIslandResponse, getServerComponentHTML, getSlotIslandResponse } from '../utils/renderer/islands'

let _componentsPromise: Promise<Record<string, any>> | undefined
function getComponents (): Promise<Record<string, any>> {
  if (!_componentsPromise) {
    _componentsPromise = getComponentsIslands().then(r => r.islandComponents)
  }
  return _componentsPromise
}

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

  const createSSRApp = await getServerEntry()

  // Pin the SSR app's root to the requested island component so
  // `serializeApp` produces the island's AST (not the wrapping app
  // shell). Resolved via the build-time `components.islands.mjs` map.
  const components = await getComponents()
  ssrContext.rootComponent = components[islandContext.name]

  const app = await createSSRApp(ssrContext, renderer.rendererContext)

  const ast = await app.runWithContext(() => serializeApp(app, undefined, ssrContext))

  // Replace v-load-client source paths (e.g. `/components/Counter.vue`)
  // with the public chunk URL (`/_nuxt/<hash>.js`) so the island
  // response doesn't leak the project's source layout to clients.
  rewriteIslandChunkPaths(ast, renderer.rendererContext)

  // Handle errors
  if (ssrContext.payload?.error) {
    throw ssrContext.payload.error
  }

  const inlinedStyles = await renderInlineStyles(ssrContext.modules ?? [])

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext })

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
        link.push({ rel: 'stylesheet', href: renderer.rendererContext.buildAssetsURL(resource.file.replace('virtual:vsc:', '')), crossorigin: '' })
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
    ast,
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

const ISLAND_PATH_PREFIX = '/__nuxt_island/'
const VALID_COMPONENT_NAME_RE = /^[a-z][\w.-]*$/i

// vue-onigiri Component tuple is `[1, props, chunkPath, exportName, slots]`
// (VServerComponentType.Component === 1). The compiler emits the source
// path of the imported `.vue` file in `chunkPath`; we rewrite it to the
// public chunk URL through the renderer's manifest.
const V_COMPONENT_TYPE = 1

interface RendererCtxWithChunks {
  manifest?: Record<string, { file?: string }>
  // Precomputed dependency map (build mode): keyed by source path, the
  // entry's `preload[src].file` is the actual chunk filename.
  _dependencies?: Record<
    string,
    { preload?: Record<string, { file?: string }> }
  >
  buildAssetsURL: (file: string) => string
}

function rewriteIslandChunkPaths (node: unknown, rendererContext: RendererCtxWithChunks): void {
  if (!node || typeof node !== 'object') { return }
  if (Array.isArray(node)) {
    if (node[0] === V_COMPONENT_TYPE && typeof node[2] === 'string') {
      const resolved = resolveChunkUrl(node[2], rendererContext)
      if (resolved) { node[2] = resolved }
      // Recurse into props (index 1) and slots (index 4) — slot bodies
      // are arrays/objects that may contain nested Component tuples.
      rewriteIslandChunkPaths(node[1], rendererContext)
      rewriteIslandChunkPaths(node[4], rendererContext)
      return
    }
    for (const child of node) {
      rewriteIslandChunkPaths(child, rendererContext)
    }
    return
  }
  for (const value of Object.values(node)) {
    rewriteIslandChunkPaths(value, rendererContext)
  }
}

function resolveChunkUrl (
  sourcePath: string,
  rendererContext: RendererCtxWithChunks,
): string | undefined {
  // Compiler emits an absolute-ish path like `/components/Counter.vue`;
  // both manifest and precomputed maps are keyed without a leading slash.
  const key = sourcePath.startsWith('/') ? sourcePath.slice(1) : sourcePath

  // Build mode: vue-bundle-renderer pre-resolves a `_dependencies` map
  // keyed by source path; the entry's `preload[key].file` is the
  // bundled chunk filename.
  const deps = rendererContext._dependencies?.[key] || rendererContext._dependencies?.[sourcePath]
  const fromDeps = deps?.preload?.[key]?.file || deps?.preload?.[sourcePath]?.file
  if (fromDeps) {
    return rendererContext.buildAssetsURL(fromDeps)
  }

  // Dev mode: fresh manifest exposes `manifest[id].file` directly.
  const manifest = rendererContext.manifest
  const entry = manifest?.[key] || manifest?.[sourcePath]
  if (entry?.file) {
    return rendererContext.buildAssetsURL(entry.file)
  }
  return undefined
}

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  let url = event.url.pathname + event.url.search + event.url.hash
  const islandPath = event.url.pathname
  if (import.meta.prerender && await islandPropCache!.hasItem(islandPath)) {
    // rehydrate props from cache so we can rerender island if cache does not have it any more
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

  const context = event.req.method === 'GET' ? getQuery<NuxtIslandContext>(event) : await readBody<NuxtIslandContext>(event)

  // Only extract known context fields to prevent arbitrary data injection
  return {
    url: typeof context?.url === 'string' ? context.url : '/',
    id: hashId,
    name: componentName,
    props: destr(context?.props) || {},
    slots: {},
    components: {},
  }
}
