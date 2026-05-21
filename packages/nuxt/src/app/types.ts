import type { SerializableHead } from '@unhead/vue'

export type { PageMeta, NuxtPageProps, NuxtLayouts } from '../pages/runtime/index'

export interface NuxtAppLiterals {
  [key: string]: string
}

export interface NuxtIslandSlotResponse {
  props: Array<unknown>
  fallback?: string
}

export interface NuxtIslandClientResponse {
  html: string
  props: unknown
  chunk: string
  slots?: Record<string, string>
}

export interface NuxtIslandContext {
  id?: string
  name: string
  props?: Record<string, any>
  url: string
  slots: Record<string, Omit<NuxtIslandSlotResponse, 'fallback'>>
  components: Record<string, Omit<NuxtIslandClientResponse, 'html'>>
}

export interface NuxtIslandResponse {
  id?: string
  html: string
  head: SerializableHead
  props?: Record<string, Record<string, any>>
  components?: Record<string, NuxtIslandClientResponse>
  slots?: Record<string, NuxtIslandSlotResponse>
}

export interface NuxtRenderHTMLContext {
  htmlAttrs: string[]
  head: string[]
  bodyAttrs: string[]
  bodyPrepend: string[]
  body: string[]
  bodyAppend: string[]
}

/**
 * Context passed to streaming-aware render hooks.
 *
 * For modules that need to participate in SSR streaming, the renderer fires
 * three additional hooks that map to the three phases of a streamed response:
 *
 * - `render:html` fires pre-shell with `streaming: true` on the second
 *   argument. Mutations to `htmlAttrs`, `head`, `bodyAttrs`, `bodyPrepend`
 *   reach the wire; mutations to `body`/`bodyAppend` are silently dropped
 *   (dev-warn). Existing modules that only mutate head fields work in
 *   streaming with no code changes.
 * - `render:html:chunk` fires for each chunk produced by Vue's renderer
 *   (after head-suspense pushes have been injected) before it is enqueued.
 *   Mutate `chunk` to transform the bytes.
 * - `render:html:close` fires after the Vue stream completes, before the
 *   closing tags. Mutate `bodyAppend` to inject final scripts/markup.
 *
 * Additionally, `render:route` fires once per request before any rendering,
 * for every render, so modules can inspect and influence how a route renders
 * (e.g. deciding at runtime whether to stream the response).
 */
export interface NuxtRenderChunkContext {
  chunk: Uint8Array
  index: number
}

export interface NuxtRenderCloseContext {
  bodyAppend: string[]
}

/**
 * Context passed to the `render:route` hook, fired once per request before
 * rendering begins. Holds the render decisions for the route; the streaming
 * decision is the first such facet and more may be added over time.
 */
export interface NuxtRenderRouteContext {
  /**
   * Whether SSR streaming is possible for this route. `false` when a
   * buffered-only feature is in play (component islands, ISR/SWR cache,
   * `noScripts`, redirects) or SSR streaming is disabled. Read-only — the
   * renderer enforces this regardless of `prefersStream`.
   */
  readonly canStream: boolean
  /**
   * Whether streaming is preferred for this request. Pre-computed from the
   * route's `streaming` rule and bot detection. Mutate it to override the
   * decision at runtime (e.g. set `false` to disable streaming for
   * authenticated users). The renderer streams only when
   * `canStream && prefersStream`, so setting it `true` on a non-streamable
   * route is a no-op.
   */
  prefersStream: boolean
}
