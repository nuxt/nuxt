import type { Nuxt, NuxtBuildOutputs } from '@nuxt/schema'

import { useNuxt } from '../context.ts'
import { addTemplate } from '../template.ts'

// This surface is experimental for as long as `NuxtServerBuild` is, and will change without
// a major release until it has settled.

/** Specifier the SSR renderer reads its build-time configuration from. */
export const RENDERER_CONFIG_SPECIFIER = 'nuxt/renderer-config'

/** The specifier the renderer imports each build artifact through, and the {@link NuxtBuildOutputs} key that provides it. */
export const BUILD_OUTPUT_SPECIFIERS: Record<string, keyof NuxtBuildOutputs> = {
  'nuxt/entry': 'serverEntry',
  'nuxt/manifest': 'clientManifest',
  'nuxt/precomputed': 'clientPrecomputed',
  'nuxt/styles': 'ssrStyles',
  'nuxt/entry-chunk': 'entryChunkName',
  'nuxt/entry-ids': 'entryIds',
}

/** Names of the constants `nuxt/renderer-config` inlines, which documents what each one means. */
export type RendererConfigName =
  | 'NUXT_NO_SSR'
  | 'NUXT_PRERENDER_ERROR_PAGES'
  | 'NUXT_PRERENDER_NO_SSR_ROUTES'
  | 'NUXT_EARLY_HINTS'
  | 'NUXT_NO_SCRIPTS'
  | 'NUXT_NO_SCRIPTS_PROD'
  | 'NUXT_INLINE_STYLES'
  | 'NUXT_VIEW_TRANSITIONS'
  | 'NUXT_NO_SCRIPTS_PATTERNS'
  | 'NUXT_PAGE_PATTERNS'
  | 'NUXT_EARLY_404'
  | 'NUXT_PAGE_MATCHER'
  | 'PARSE_ERROR_DATA'
  | 'NUXT_PAYLOAD_EXTRACTION'
  | 'NUXT_PAYLOAD_INLINE'
  | 'NUXT_RUNTIME_PAYLOAD_EXTRACTION'
  | 'NUXT_SSR_STREAMING'
  | 'NUXT_SSR_STREAMING_BOT_RE'
  | 'appHead'
  | 'appRootTag'
  | 'appRootAttrs'
  | 'appTeleportTag'
  | 'appTeleportAttrs'
  | 'appSpaLoaderTag'
  | 'appSpaLoaderAttrs'
  | 'spaLoadingTemplateOutside'
  | 'spaTemplate'
  | 'appId'
  | 'multiApp'
  | 'componentIslands'
  | 'componentIslandsActive'
  | 'tracingChannelNuxt'

export interface RendererConfigOptions {
  /** JS expressions replacing individual constants, for values a builder resolves itself. */
  overrides?: Partial<Record<RendererConfigName, string>>
  /** Specifier the generated module re-exports unhead's `createHead` options from. */
  unheadOptions?: string
  /** Specifier the generated module re-exports the head module's own render options from. */
  headConfig?: string
}

/**
 * Generate the body of the `nuxt/renderer-config` module the SSR renderer imports its
 * build-time configuration from.
 *
 * Everything derivable from `nuxt.options` is inlined; the rest defaults to the value of a
 * build without the feature and is replaced through `overrides`.
 *
 * @internal
 */
export function getRendererConfig (options: RendererConfigOptions = {}, nuxt: Nuxt = useNuxt()): string {
  const app = nuxt.options.app
  const noScripts = nuxt.options.features.noScripts
  const payloadExtraction = nuxt.options.experimental.payloadExtraction
  const streaming = nuxt.options.experimental.ssrStreaming
  const streamingEnabled = typeof streaming === 'object' && !!streaming.enabled

  const values: Record<RendererConfigName, string> = {
    NUXT_NO_SSR: String(nuxt.options.ssr === false),
    NUXT_PRERENDER_ERROR_PAGES: '[]',
    NUXT_PRERENDER_NO_SSR_ROUTES: '[]',
    NUXT_EARLY_HINTS: String(nuxt.options.experimental.writeEarlyHints !== false),
    NUXT_NO_SCRIPTS: String(noScripts === 'all' || (!!noScripts && !nuxt.options.dev)),
    NUXT_NO_SCRIPTS_PROD: String(noScripts === 'production'),
    NUXT_INLINE_STYLES: String(!!nuxt.options.features.inlineStyles),
    NUXT_VIEW_TRANSITIONS: String(!!(app.viewTransition && typeof app.viewTransition === 'object' && app.viewTransition.enabled)),
    NUXT_NO_SCRIPTS_PATTERNS: '[]',
    NUXT_PAGE_PATTERNS: '[]',
    NUXT_EARLY_404: 'false',
    NUXT_PAGE_MATCHER: 'undefined',
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    PARSE_ERROR_DATA: String(!!nuxt.options.experimental.parseErrorData),
    NUXT_PAYLOAD_EXTRACTION: String(payloadExtraction !== false),
    NUXT_PAYLOAD_INLINE: String(payloadExtraction !== true),
    NUXT_RUNTIME_PAYLOAD_EXTRACTION: 'false',
    NUXT_SSR_STREAMING: String(streamingEnabled),
    NUXT_SSR_STREAMING_BOT_RE: streamingEnabled && streaming.botRegex instanceof RegExp ? String(streaming.botRegex) : '/^$/',
    appHead: JSON.stringify(app.head),
    appRootTag: JSON.stringify(app.rootTag),
    appRootAttrs: JSON.stringify(app.rootAttrs),
    appTeleportTag: JSON.stringify(app.teleportTag),
    appTeleportAttrs: JSON.stringify(app.teleportAttrs),
    appSpaLoaderTag: JSON.stringify(app.spaLoaderTag),
    appSpaLoaderAttrs: JSON.stringify(app.spaLoaderAttrs),
    spaLoadingTemplateOutside: String(nuxt.options.experimental.spaLoadingTemplateLocation === 'body'),
    spaTemplate: '""',
    appId: JSON.stringify(nuxt.options.appId),
    multiApp: String(!!nuxt.options.future.multiApp),
    componentIslands: 'false',
    componentIslandsActive: 'false',
    tracingChannelNuxt: String(!!(nuxt.options.tracingChannel && typeof nuxt.options.tracingChannel === 'object' && nuxt.options.tracingChannel.nuxt)),
  }

  const lines = [
    `export { default as unheadOptions } from ${JSON.stringify(options.unheadOptions || '#build/unhead-options.mjs')}`,
    `export { iifeChunkFileName, renderSSRHeadOptions } from ${JSON.stringify(options.headConfig || '#build/unhead.config.mjs')}`,
  ]
  for (const name in values) {
    const key = name as RendererConfigName
    lines.push(`export const ${key} = ${options.overrides?.[key] ?? values[key]}`)
  }

  return lines.join('\n')
}

/**
 * Write the `nuxt/renderer-config` module for this build and alias the specifier to it.
 *
 * @internal
 */
export function addRendererConfig (options: RendererConfigOptions = {}, nuxt: Nuxt = useNuxt()): string {
  const { dst } = addTemplate({
    filename: 'renderer-config.mjs',
    write: true,
    getContents: ({ nuxt }) => getRendererConfig(options, nuxt),
  })

  nuxt.options.alias[RENDERER_CONFIG_SPECIFIER] = dst

  return dst
}

/**
 * The build-time replacements the renderer must be compiled with. A builder that does not
 * apply them ships both sides of every branch, and reaches the runtime with
 * `import.meta.prerender` undefined.
 *
 * @internal
 */
export function getRendererDefines (phase: 'server' | 'prerender', nuxt: Nuxt = useNuxt()): Record<string, string> {
  return {
    'import.meta.dev': String(!!nuxt.options.dev),
    'import.meta.server': 'true',
    'import.meta.client': 'false',
    'import.meta.prerender': String(phase === 'prerender'),
  }
}
