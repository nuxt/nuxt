import type { RequestEventFallback, RuntimeRequestEvent } from '@nuxt/schema'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext, NuxtSSRContext } from '#app/types'

/**
 * The request event the renderer reads, described in web standards only.
 *
 * A server runtime whose own event has another shape (an `h3` v1 event, say) hands the
 * renderer this view of it and names the event the application sees in {@link app}, so
 * that `useRequestEvent()` and the render hooks keep receiving the runtime's own event.
 */
export interface RendererEvent extends RequestEventFallback {
  /**
   * The event the application sees, where the runtime's own event is not web-shaped.
   *
   * Prefixed, because a server runtime's own event may carry an `app` of its own (h3 v2's
   * event does), and read only through {@link appEvent}.
   */
  '~app'?: RuntimeRequestEvent
}

/** The event to hand to application code and to the hooks a server runtime exposes. */
export function appEvent (event: RendererEvent): RuntimeRequestEvent {
  return (event['~app'] ?? event) as unknown as RuntimeRequestEvent
}

/**
 * A response the renderer has assembled but not yet handed to a platform `Response`:
 * the shape `ssrContext['~renderResponse']` and the payload cache are described in.
 */
export interface RenderedResponse {
  body?: unknown
  statusCode?: number
  statusMessage?: string
  headers?: Record<string, string>
}

/** A response the renderer stored while prerendering, keyed by payload URL. */
export interface CachedResponse extends RenderedResponse {
  body: string
}

/** The route rules the renderer reads, as resolved by the server runtime for a request. */
export interface RendererRouteRules {
  /** Whether to server-render the route. */
  ssr?: boolean
  streaming?: boolean
  noScripts?: boolean
  prerender?: boolean
  redirect?: unknown
  isr?: number | boolean | object
  cache?: false | { maxAge?: number }
}

/** Hooks the renderer calls while rendering a route. */
export interface RendererHooks {
  callHook(name: 'render:route', context: NuxtRenderRouteContext, extra: { event: RuntimeRequestEvent }): void | Promise<void>
  callHook(name: 'render:html', context: NuxtRenderHTMLContext, extra: { event: RuntimeRequestEvent, streaming?: boolean }): void | Promise<void>
  callHook(name: 'render:html:chunk', context: NuxtRenderChunkContext, extra: { event: RuntimeRequestEvent }): void | Promise<void>
  callHook(name: 'render:html:close', context: NuxtRenderCloseContext, extra: { event: RuntimeRequestEvent }): void | Promise<void>
  callHook(name: 'render:island', response: NuxtIslandResponse, extra: { event: RuntimeRequestEvent, islandContext: NuxtIslandContext }): void | Promise<void>
}

/** Storage for the payloads rendered alongside a prerendered route. */
export interface PayloadCache {
  hasItem(key: string): Promise<boolean> | boolean
  getItem(key: string): Promise<CachedResponse | null | undefined> | CachedResponse | null | undefined
  setItem(key: string, value: CachedResponse): Promise<unknown> | unknown
}

/** Capabilities the server runtime provides to the renderer for each build. */
export interface NuxtRendererOptions {
  /**
   * Resolved runtime config. The event is passed because a runtime may hand out a copy
   * per request, which its own plugins are then free to mutate for that request alone.
   */
  runtimeConfig: (event: RendererEvent) => NuxtSSRContext['runtimeConfig']
  /** URL of a file emitted into the build assets directory. */
  buildAssetsURL: (...path: string[]) => string
  /** URL of a file served from the public directory. */
  publicAssetsURL: (...path: string[]) => string
  /** Route rules matched for a request, with any base URL applied by the caller. */
  getRouteRules: (event: RendererEvent) => RendererRouteRules
  /** Hooks the surrounding server runtime exposes to modules. */
  hooks: () => RendererHooks
  /** Response constructor, so a runtime can provide a faster implementation than the platform's `Response`. */
  createResponse: (body: BodyInit | null, init?: ResponseInit) => Response
  /** Error carrying an HTTP status, thrown for requests the renderer refuses. */
  createError: (init: { status: number, statusText?: string, data?: unknown, headers?: Record<string, string> }) => Error
  /** Send `103 Early Hints`, when the runtime supports them. */
  writeEarlyHints?: (event: RendererEvent, hints: { link: string }) => void
  /** Render an island request, when the runtime serves islands. */
  renderIsland?: (event: RendererEvent) => Promise<Response> | Response
  /** Prerender-only capabilities, absent from a runtime build. */
  prerender?: {
    payloadCache: PayloadCache
    sharedDataCache?: NuxtSSRContext['~sharedPrerenderCache']
    /** Wrap a render so the runtime can track the URLs in flight. */
    wrapRender?: <T>(event: RendererEvent, render: () => Promise<T>) => Promise<T>
  }
}

/**
 * The options of the renderer created for this bundle, installed by
 * {@link createNuxtRenderer} and read lazily, so a module can be imported before
 * the renderer is created.
 */
export const serverRuntime: NuxtRendererOptions = /* @__PURE__ */ {} as NuxtRendererOptions

export function setServerRuntime (options: NuxtRendererOptions): void {
  for (const key of Object.keys(serverRuntime)) {
    Reflect.deleteProperty(serverRuntime, key)
  }
  Object.assign(serverRuntime, options)
}

/** Per-request Nuxt state the renderer reads from the request event, populated by the server runtime. */
export interface NuxtRequestState {
  'noSSR'?: boolean
  /** Set by the runtime for a request it made to itself, which may reach internal routes. */
  '~internal'?: boolean
  /** Set when the runtime re-enters the renderer to render an error page. */
  '~rendering-error'?: boolean
  /** Dev-only: CSS module URLs the builder has loaded for this request. */
  '~devClientCss'?: string[]
  /** Dev-only: serialized cause of the error being rendered. */
  '~error-cause'?: unknown
}

export function getRequestState (event: RendererEvent): NuxtRequestState | undefined {
  return (event.context as { nuxt?: NuxtRequestState }).nuxt
}
