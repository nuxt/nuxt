import type { RequestEvent } from '@nuxt/schema'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext, NuxtSSRContext } from '#app/types'

/** A response the renderer stored while prerendering, keyed by payload URL. */
export interface CachedResponse {
  body: string
  status: number
  statusText: string
  headers: Record<string, string>
}

/** The route rules the renderer reads, as resolved by the server runtime for a request. */
export interface RendererRouteRules {
  ssr?: boolean
  streaming?: boolean
  noScripts?: boolean
  prerender?: boolean
  redirect?: unknown
  isr?: number | boolean
  cache?: false | { maxAge?: number }
}

/** Hooks the renderer calls while rendering a route. */
export interface RendererHooks {
  callHook(name: 'render:route', context: NuxtRenderRouteContext, extra: { event: RequestEvent }): void | Promise<void>
  callHook(name: 'render:html', context: NuxtRenderHTMLContext, extra: { event: RequestEvent, streaming?: boolean }): void | Promise<void>
  callHook(name: 'render:html:chunk', context: NuxtRenderChunkContext, extra: { event: RequestEvent }): void | Promise<void>
  callHook(name: 'render:html:close', context: NuxtRenderCloseContext, extra: { event: RequestEvent }): void | Promise<void>
  callHook(name: 'render:island', response: NuxtIslandResponse, extra: { event: RequestEvent, islandContext: NuxtIslandContext }): void | Promise<void>
}

/** Storage for the payloads rendered alongside a prerendered route. */
export interface PayloadCache {
  hasItem(key: string): Promise<boolean> | boolean
  getItem(key: string): Promise<CachedResponse | null | undefined> | CachedResponse | null | undefined
  setItem(key: string, value: CachedResponse): Promise<unknown> | unknown
}

/** Capabilities the server runtime provides to the renderer for each build. */
export interface NuxtRendererOptions {
  /** Resolved runtime config, read once per request. */
  runtimeConfig: () => NuxtSSRContext['runtimeConfig']
  /** URL of a file emitted into the build assets directory. */
  buildAssetsURL: (...path: string[]) => string
  /** URL of a file served from the public directory. */
  publicAssetsURL: (...path: string[]) => string
  /** Route rules matched for a request, with any base URL applied by the caller. */
  getRouteRules: (event: RequestEvent) => RendererRouteRules
  /** Hooks the surrounding server runtime exposes to modules. */
  hooks: () => RendererHooks
  /** Response constructor, so a runtime can provide a faster implementation than the platform's `Response`. */
  createResponse: (body: BodyInit | null, init?: ResponseInit) => Response
  /** Error carrying an HTTP status, thrown for requests the renderer refuses. */
  createError: (init: { status: number, statusText?: string, data?: unknown, headers?: Record<string, string> }) => Error
  /** Send `103 Early Hints`, when the runtime supports them. */
  writeEarlyHints?: (event: RequestEvent, hints: { link: string }) => void
  /** Render an island request, when the runtime serves islands. */
  renderIsland?: (event: RequestEvent) => Promise<Response> | Response
  /** Prerender-only capabilities, absent from a runtime build. */
  prerender?: {
    payloadCache: PayloadCache
    sharedDataCache?: NuxtSSRContext['~sharedPrerenderCache']
    /** Wrap a render so the runtime can track the URLs in flight. */
    wrapRender?: <T>(event: RequestEvent, render: () => Promise<T>) => Promise<T>
  }
}

/**
 * The options of the renderer created for this bundle, installed by
 * {@link createNuxtRenderer} and read lazily, so a module can be imported before
 * the renderer is created.
 */
export const serverRuntime: NuxtRendererOptions = /* @__PURE__ */ {} as NuxtRendererOptions

export function setServerRuntime (options: NuxtRendererOptions): void {
  Object.assign(serverRuntime, options)
}

/** Per-request Nuxt state the renderer reads from the request event, populated by the server runtime. */
export interface NuxtRequestState {
  'noSSR'?: boolean
  /** Set when the runtime re-enters the renderer to render an error page. */
  '~rendering-error'?: boolean
  /** Dev-only: CSS module URLs the builder has loaded for this request. */
  '~devClientCss'?: string[]
  /** Dev-only: serialized cause of the error being rendered. */
  '~error-cause'?: unknown
}

export function getRequestState (event: RequestEvent): NuxtRequestState | undefined {
  return (event.context as { nuxt?: NuxtRequestState }).nuxt
}
