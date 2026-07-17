/**
 * Minimal server-compatible types for the parts of `nuxt/app` types that are needed in
 * `@nuxt/nitro-server` and `@nuxt/schema`.
 */
import type { SerializableHead } from '@unhead/vue'
import type { UseHeadInput, VueHeadClient } from '@unhead/vue/types'
import type { SSRHeadPayload } from '@unhead/vue/server'
import type { SSRContext, createRenderer } from 'vue-bundle-renderer/runtime'
import type { H3Event, HTTPError } from '@nuxt/nitro-server/h3'
import type { Hookable } from 'hookable'
import type { RuntimeConfig } from 'nuxt/schema'

type HookResult = Promise<void> | void

export interface NuxtAppLiterals {
  [key: string]: string
}

export interface PluginMeta {
  name?: string
  enforce?: 'pre' | 'default' | 'post'
  /**
   * Await for other named plugins to finish before running this plugin.
   */
  dependsOn?: NuxtAppLiterals['pluginName'][]
  /**
   * This allows more granular control over plugin order and should only be used by advanced users.
   * It overrides the value of `enforce` and is used to sort plugins.
   */
  order?: number
}

/**
 * Create a NuxtLink component with given options as defaults.
 *
 * Declared without reference to `vue-router` types so this leaf does not
 * force a (possibly duplicated) `vue-router` instance into consuming
 * programs; the fields mirror `RouterLinkProps['activeClass' |
 * 'exactActiveClass']` and `NuxtLinkProps['prefetch' | 'prefetchedClass' |
 * 'prefetchOn']` in `../components/nuxt-link.ts`.
 * @see https://nuxt.com/docs/4.x/api/components/nuxt-link
 */
export interface NuxtLinkOptions {
  /**
   * The name of the component.
   * @default "NuxtLink"
   */
  componentName?: string
  /**
   * A default `rel` attribute value applied on external links. Defaults to `"noopener noreferrer"`. Set it to `""` to disable.
   */
  externalRelAttribute?: string | null
  /**
   * An option to either add or remove trailing slashes in the `href`.
   * If unset or not matching the valid values `append` or `remove`, it will be ignored.
   */
  trailingSlash?: 'append' | 'remove'
  /** A class to apply to active links. */
  activeClass?: string
  /** A class to apply to exact active links. */
  exactActiveClass?: string
  /** A class to apply to links that have been prefetched. */
  prefetchedClass?: string
  /** When enabled will prefetch middleware, layouts and payloads of links in the viewport. */
  prefetch?: boolean
  /**
   * Allows controlling default setting for when to prefetch links. By default, prefetch is triggered only on visibility.
   */
  prefetchOn?: Partial<{
    visibility: boolean
    interaction: boolean
  }>
}

type AppRenderedContext = { ssrContext: NuxtSSRContext | undefined, renderResult: null | Awaited<ReturnType<ReturnType<typeof createRenderer>['renderToString']>> }

/**
 * The runtime app hooks fired from the server runtime. The full
 * `RuntimeNuxtHooks` interface in `./nuxt.ts` extends this with the
 * client-side hooks, whose signatures need the DOM lib.
 */
export interface NuxtServerRuntimeHooks {
  'app:error': (err: any) => HookResult
  'app:rendered': (ctx: AppRenderedContext) => HookResult
}

/**
 * The part of the runtime Nuxt app addressable from the server runtime
 * (`ssrContext.nuxt`). The full `NuxtApp` in `./nuxt.ts` is assignable to
 * this shape; `hooks` is deliberately narrowed to the members the server
 * runtime calls, as `Hookable` instantiations over different hook maps are
 * not mutually assignable.
 */
export interface NuxtServerApp {
  hooks: Pick<Hookable<NuxtServerRuntimeHooks>, 'hook' | 'callHook'>
  payload: NuxtPayload
  ssrContext?: NuxtSSRContext
  [key: string]: unknown
}

/**
 * Type-only declaration of the `NuxtError` class in
 * `./composables/error.ts`, which remains the canonical exported value (and
 * the `NuxtError` type exported from `nuxt/app` / `#app`).
 */
export interface NuxtError<DataT = unknown> extends HTTPError<DataT> {
  readonly __nuxt_error: true
  readonly fatal: boolean
}

export interface NuxtPayload {
  path?: string
  serverRendered?: boolean
  prerenderedAt?: number
  data: Record<string, any>
  state: Record<string, any>
  once: Set<string>
  config?: Pick<RuntimeConfig, 'public' | 'app'>
  error?: NuxtError | undefined
  _errors: Record<string, NuxtError | undefined>
  /**
   * Forwarded `<link rel="preload">` / `<link rel="modulepreload">` hints from the destination route, populated when `experimental.prefetchPreloadTags` is enabled.
   * @internal
   */
  prefetchLinks?: Array<Record<string, string | boolean>>
  [key: string]: unknown
}

export interface NuxtSSRContext extends SSRContext {
  url: string
  event: H3Event
  runtimeConfig: RuntimeConfig
  noSSR: boolean
  /** whether we are rendering an SSR error */
  error?: boolean
  nuxt: NuxtServerApp
  payload: Partial<NuxtPayload>
  head: VueHeadClient<UseHeadInput, SSRHeadPayload>
  /** This is used solely to render runtime config with SPA renderer. */
  config?: Pick<RuntimeConfig, 'public' | 'app'>
  teleports?: Record<string, string>
  islandContext?: NuxtIslandContext
  /** @internal */
  ['~renderResponse']?: Response
  /** @internal */
  ['~payloadReducers']: Record<string, (data: any) => any>
  /** @internal */
  ['~sharedPrerenderCache']?: {
    get<T = unknown> (key: string): Promise<T> | undefined
    set<T> (key: string, value: Promise<T>): Promise<void>
  }
  /** @internal */
  ['~preloadManifest']?: boolean
  /** @internal */
  ['~lazyHydratedModules']?: Set<string>
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
 * Context passed to the `render:html:chunk` hook, fired for each chunk
 * produced by Vue's renderer (after head-suspense pushes have been
 * injected) before it is enqueued. Mutate `chunk` to transform the bytes.
 */
export interface NuxtRenderChunkContext {
  chunk: Uint8Array
  index: number
}

/**
 * Context passed to the `render:html:close` hook, fired after the Vue
 * stream completes, before the closing tags. Mutate `bodyAppend` to
 * inject final scripts/markup.
 */
export interface NuxtRenderCloseContext {
  bodyAppend: string[]
}

/**
 * Context passed to the `render:route` hook, fired once per request
 * before rendering begins (streaming enabled or not).
 */
export interface NuxtRenderRouteContext {
  /**
   * Whether SSR streaming is possible for this route. `false` when a
   * buffered-only feature is in play (component islands, ISR/SWR cache,
   * `noScripts`, redirects) or SSR streaming is disabled. Read-only: the
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
