import type { SerializableHead } from '@unhead/vue/types'
import type { CreateServerHeadOptions } from '@unhead/vue/server'

/**
 * Build-time configuration for the SSR renderer, provided by the configured
 * `server.builder`, which replaces this module in its server bundle. Values are
 * inlined so a build folds away the branches it does not use; anything only known
 * at runtime is passed to `createNuxtRenderer()` instead.
 *
 * The defaults below describe a build with every optional feature disabled.
 */

/** Whether `ssr: false` is set for the whole app. */
export const NUXT_NO_SSR: boolean = false
/** Status codes whose error pages (`404.html` and so on) are server-rendered at build time. */
export const NUXT_PRERENDER_ERROR_PAGES: number[] = []
/** Prerendered routes written out as an empty SPA shell. */
export const NUXT_PRERENDER_NO_SSR_ROUTES: string[] = []
/** Whether to send `103 Early Hints`. */
export const NUXT_EARLY_HINTS: boolean = false
/** Whether every route is served without scripts. */
export const NUXT_NO_SCRIPTS: boolean = false
/** Whether scripts will be stripped in production only (dev-only diagnostics). */
export const NUXT_NO_SCRIPTS_PROD: boolean = false
/** Whether CSS is inlined into the document. */
export const NUXT_INLINE_STYLES: boolean = false
/** Whether cross-document view transitions are enabled. */
export const NUXT_VIEW_TRANSITIONS: boolean = false
/** `href_matches` patterns for routes served without scripts. */
export const NUXT_NO_SCRIPTS_PATTERNS: string[] = []
/** `href_matches` patterns for every page route. */
export const NUXT_PAGE_PATTERNS: string[] = []
/** Whether unmatched page paths 404 before the app is loaded. */
export const NUXT_EARLY_404: boolean = false
/** Matcher compiled from every page route, present when {@link NUXT_EARLY_404} is set. */
export const NUXT_PAGE_MATCHER: ((method: string, path: string) => unknown) | undefined = undefined
/** Whether payloads are rendered as JSON rather than as inline JavaScript. */
export const NUXT_JSON_PAYLOADS: boolean = true
/** Whether `error.data` reaches the error page stringified. */
export const PARSE_ERROR_DATA: boolean = true
/** Whether payloads are extracted into `_payload.json` when prerendering. */
export const NUXT_PAYLOAD_EXTRACTION: boolean = false
/** Whether the full payload is inlined into the document. */
export const NUXT_PAYLOAD_INLINE: boolean = true
/** Whether payloads are extracted at runtime for cached routes. */
export const NUXT_RUNTIME_PAYLOAD_EXTRACTION: boolean = false
/** Whether SSR streaming is enabled. */
export const NUXT_SSR_STREAMING: boolean = false
/** User agents that are served a buffered response even when streaming is enabled. */
export const NUXT_SSR_STREAMING_BOT_RE: RegExp = /^$/

/** Head entries configured in `app.head`. */
export const appHead: SerializableHead = {}
export const appRootTag: string = 'div'
export const appRootAttrs: Record<string, string> = { id: '__nuxt' }
export const appTeleportTag: string = 'div'
export const appTeleportAttrs: Record<string, string> = { id: 'teleports' }
export const appSpaLoaderTag: string = 'div'
export const appSpaLoaderAttrs: Record<string, string> = { id: '__nuxt-loader' }
export const spaLoadingTemplateOutside: boolean = false
/** Markup rendered inside the app root while a client-only app boots. */
export const spaTemplate: string = ''
export const appId: string = 'nuxt-app'
export const multiApp: boolean = false
/** Whether island rendering is compiled into the build. */
export const componentIslands: boolean = false
/** Whether the app actually renders islands (server components or server pages). */
export const componentIslandsActive: boolean = false
/** Whether Nuxt-owned `diagnostics_channel` tracing is enabled. */
export const tracingChannelNuxt: boolean = false

/** Options `unhead` is created with for each request. */
export const unheadOptions: CreateServerHeadOptions = {}
/** Options applied when rendering head tags. */
export const renderSSRHeadOptions: { omitLineBreaks?: boolean } = {}
/** File name of the streaming bootstrap chunk, when SSR streaming is enabled. */
export const iifeChunkFileName: string | undefined = undefined
