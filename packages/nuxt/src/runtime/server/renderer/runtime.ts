import type { NuxtRequestEvent } from '@nuxt/schema'
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
  /**
   * Whether to server-render the route. A route is only server-rendered when this is
   * present and truthy: `h3` resolves a `false` rule by removing it, so a runtime that
   * matches rules with `h3` reports an opted-out route as one carrying no `ssr` rule.
   */
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
  callHook(name: 'render:route', context: NuxtRenderRouteContext, extra: { event: NuxtRequestEvent }): void | Promise<void>
  callHook(name: 'render:html', context: NuxtRenderHTMLContext, extra: { event: NuxtRequestEvent, streaming?: boolean }): void | Promise<void>
  callHook(name: 'render:html:chunk', context: NuxtRenderChunkContext, extra: { event: NuxtRequestEvent }): void | Promise<void>
  callHook(name: 'render:html:close', context: NuxtRenderCloseContext, extra: { event: NuxtRequestEvent }): void | Promise<void>
  callHook(name: 'render:island', response: NuxtIslandResponse, extra: { event: NuxtRequestEvent, islandContext: NuxtIslandContext }): void | Promise<void>
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
  getRouteRules: (event: NuxtRequestEvent) => RendererRouteRules
  /** Hooks the surrounding server runtime exposes to modules. */
  hooks: () => RendererHooks
  /** Response constructor, so a runtime can provide a faster implementation than the platform's `Response`. */
  createResponse: (body: BodyInit | null, init?: ResponseInit) => Response
  /** Error carrying an HTTP status, thrown for requests the renderer refuses. */
  createError: (init: { status: number, statusText?: string, data?: unknown, headers?: Record<string, string> }) => Error
  /** Send `103 Early Hints`, when the runtime supports them. */
  writeEarlyHints?: (event: NuxtRequestEvent, hints: { link: string }) => void
  /** Render an island request, when the runtime serves islands. */
  renderIsland?: (event: NuxtRequestEvent) => Promise<Response> | Response
  /** Prerender-only capabilities, absent from a runtime build. */
  prerender?: {
    payloadCache: PayloadCache
    sharedDataCache?: NuxtSSRContext['~sharedPrerenderCache']
    /** Wrap a render so the runtime can track the URLs in flight. */
    wrapRender?: <T>(event: NuxtRequestEvent, render: () => Promise<T>) => Promise<T>
  }
}

/** Per-request Nuxt state the renderer reads from the request event, populated by the server runtime. */
export interface NuxtRequestState {
  'noSSR'?: boolean
  /** Routes the render asked the server runtime to prerender as well, as raw paths. */
  'prerenderRoutes'?: string[]
  /** Set when the runtime re-enters the renderer to render an error page. */
  '~rendering-error'?: boolean
  /** Dev-only: CSS module URLs the builder has loaded for this request. */
  '~devClientCss'?: string[]
  /** Dev-only: serialized cause of the error being rendered. */
  '~error-cause'?: unknown
}

export function getRequestState (event: NuxtRequestEvent): NuxtRequestState | undefined {
  return (event.context as { nuxt?: NuxtRequestState }).nuxt
}

/**
 * Ask the server runtime to prerender `paths` alongside the route being rendered. What the
 * runtime does with them is its own concern; a runtime that does not prerender ignores them.
 */
export function addPrerenderRoutes (event: NuxtRequestEvent, ...paths: string[]): void {
  const context = event.context as { nuxt?: NuxtRequestState }
  const state = context.nuxt ||= {}
  state.prerenderRoutes ||= []
  state.prerenderRoutes.push(...paths)
}
