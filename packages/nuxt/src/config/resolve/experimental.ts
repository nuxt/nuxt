import type { NuxtOptions } from '@nuxt/schema'

import { optionsDiagnostics } from '../diagnostics.ts'
import { bool, isObject, oneOf, withDefaults } from '../validate.ts'
import type { RawConfig } from '../validate.ts'

export type ExperimentalOptions = Pick<NuxtOptions, 'future' | 'features' | 'experimental'>

type Resolved = Pick<NuxtOptions, 'dev' | 'test' | 'ssr' | 'debug' | 'builder' | 'typescript'>

export function resolveExperimental (input: RawConfig, resolved: Resolved): ExperimentalOptions {
  const experimental = resolveExperimentalNamespace(input.experimental, resolved)
  return {
    future: resolveFuture(input.future, experimental, resolved.typescript),
    features: resolveFeatures(input.features, experimental, resolved),
    experimental,
  }
}

function resolveFuture (value: unknown, experimental: RawConfig, typescript: NuxtOptions['typescript']): NuxtOptions['future'] {
  const future = withDefaults('future', value, { multiApp: false })
  if (future.compatibilityVersion !== undefined && future.compatibilityVersion !== 5) {
    optionsDiagnostics.NUXT_B5029({ value: String(future.compatibilityVersion) })
  }

  let typescriptBundlerResolution = typeof future.typescriptBundlerResolution === 'boolean'
    ? future.typescriptBundlerResolution
    : experimental.typescriptBundlerResolution
  if (typeof typescriptBundlerResolution !== 'boolean') {
    const moduleResolution = typescript.tsConfig?.compilerOptions?.moduleResolution
    typescriptBundlerResolution = moduleResolution ? moduleResolution.toLowerCase() === 'bundler' : true
  }

  return {
    ...future,
    compatibilityVersion: 5,
    typescriptBundlerResolution,
  } as NuxtOptions['future']
}

const NO_SCRIPTS_VALUES = ['production', 'all'] as const

function resolveFeatures (value: unknown, experimental: RawConfig, resolved: Resolved): NuxtOptions['features'] {
  const features = withDefaults('features', value, {})

  const inlineStylesInput = typeof features.inlineStyles === 'boolean' || typeof features.inlineStyles === 'function'
    ? features.inlineStyles
    : experimental.inlineSSRStyles as undefined | boolean
  const inlineStyles = inlineStylesInput === false || resolved.dev || !resolved.ssr
    ? false
    : inlineStylesInput ?? ((id?: string) => !!id && id.includes('.vue'))

  const noScripts = features.noScripts === true
    ? 'production'
    : features.noScripts === false || NO_SCRIPTS_VALUES.includes(features.noScripts)
      ? features.noScripts
      : (experimental.noScripts && 'production') ?? false

  return {
    ...features,
    inlineStyles,
    devLogs: typeof features.devLogs === 'boolean' || features.devLogs === 'silent'
      ? features.devLogs
      : resolved.dev && !resolved.test,
    noScripts,
  } as NuxtOptions['features']
}

const EMIT_ROUTE_CHUNK_ERROR_VALUES = ['manual', 'automatic', 'automatic-immediate'] as const

// Indexing crawlers only. `chrome-lighthouse` is absent so that audit tools measure the same
// streamed response real users get.
const DEFAULT_BOT_REGEX = /bot\b|crawl|spider|slurp|facebookexternalhit|google\b|bing\b|yandex\b|baidu\b|duckduck/i

function resolveExperimentalNamespace (value: unknown, resolved: Resolved): NuxtOptions['experimental'] {
  const experimental = withDefaults('experimental', value, {
    runtimeBaseURL: false,
    decorators: false,
    serverAppConfig: true,
    templateRouteInjection: true,
    restoreState: false,
    noVueServer: false,
    staticRoutes: false,
    early404: false,
    templateDiagnostics: true,
    webmcp: false,
    clientFallback: false,
    crossOriginPrefetch: false,
    deferPrefetchHints: true,
    viewTransition: false,
    writeEarlyHints: false,
    localLayerAliases: true,
    appManifest: true,
    checkOutdatedBuildInterval: 1000 * 60 * 60,
    asyncContext: false,
    headNext: true,
    inlineRouteRules: false,
    extraPageMetaExtractionKeys: [],
    cookieStore: true,
    defaults: {
      nuxtLink: {
        componentName: 'NuxtLink',
        prefetch: true,
        prefetchOn: {
          visibility: true,
        },
      },
      useAsyncData: {
        deep: false,
      },
      useFetch: {},
    },
    clientNodeCompat: false,
    navigationRepaint: true,
    buildCache: false,
    chromeDevtoolsProjectSettings: true,
    templateImportResolution: true,
    stripNeverHydratedData: false,
    enforceModuleCompatibility: false,
    entryImportMap: true,
    compileHints: true,
    layoutChunk: true,
    parallelBuild: true,
    clearBuildHooks: true,
    compilerComponentResolution: true,
  })

  if (experimental.parseErrorData === false) {
    optionsDiagnostics.NUXT_B5016()
  }

  const ssrStreaming = isObject(experimental.ssrStreaming) ? experimental.ssrStreaming as { enabled?: boolean, botRegex?: RegExp } : null
  const ssrStreamingEnabled = experimental.ssrStreaming === true || (ssrStreaming !== null && ssrStreaming.enabled !== false)

  return {
    ...experimental,
    strictRouteTypes: experimental.strictRouteTypes === 'isomorphic' || typeof experimental.strictRouteTypes === 'boolean' ? experimental.strictRouteTypes : false,
    asyncEntry: bool('experimental.asyncEntry', experimental.asyncEntry, false),
    emitRouteChunkError: resolveEmitRouteChunkError(experimental.emitRouteChunkError),
    payloadExtraction: !resolved.ssr
      ? false
      : experimental.payloadExtraction === 'client' || typeof experimental.payloadExtraction === 'boolean' ? experimental.payloadExtraction : 'client',
    inlineErrorRendering: bool('experimental.inlineErrorRendering', experimental.inlineErrorRendering, true),
    prerenderErrorPages: resolvePrerenderErrorPages(experimental.prerenderErrorPages),
    ssrErrorBoundary: typeof experimental.ssrErrorBoundary === 'boolean' ? experimental.ssrErrorBoundary : true,
    componentIslands: experimental.componentIslands === 'local+remote'
      ? { remoteIsland: true }
      : experimental.componentIslands === 'local' ? true : experimental.componentIslands ?? 'auto',
    typedPages: bool('experimental.typedPages', experimental.typedPages, true),
    serverPathFallback: bool('experimental.serverPathFallback', experimental.serverPathFallback, true),
    watcher: oneOf('experimental.watcher', experimental.watcher, ['chokidar', 'parcel', 'chokidar-granular', 'builder'], 'builder'),
    scanPageMeta: typeof experimental.scanPageMeta === 'boolean' || experimental.scanPageMeta === 'after-resolve' ? experimental.scanPageMeta : 'after-resolve',
    extractSerializablePageMeta: bool('experimental.extractSerializablePageMeta', experimental.extractSerializablePageMeta, true),
    sharedPrerenderData: bool('experimental.sharedPrerenderData', experimental.sharedPrerenderData, true),
    defaults: {
      ...experimental.defaults,
      useState: {
        ...experimental.defaults.useState,
        resetOnClear: bool('experimental.defaults.useState.resetOnClear', experimental.defaults.useState?.resetOnClear, true),
      },
      navigateTo: {
        ...experimental.defaults.navigateTo,
        noopener: bool('experimental.defaults.navigateTo.noopener', experimental.defaults.navigateTo?.noopener, true),
      },
    },
    navigateToEarlyReturn: bool('experimental.navigateToEarlyReturn', experimental.navigateToEarlyReturn, true),
    normalizeComponentNames: bool('experimental.normalizeComponentNames', experimental.normalizeComponentNames, true),
    normalizePageNames: bool('experimental.normalizePageNames', experimental.normalizePageNames, true),
    spaLoadingTemplateLocation: oneOf('experimental.spaLoadingTemplateLocation', experimental.spaLoadingTemplateLocation, ['body', 'within'], 'body'),
    browserDevtoolsTiming: typeof experimental.browserDevtoolsTiming === 'boolean' ? experimental.browserDevtoolsTiming : resolved.dev,
    debugModuleMutation: typeof experimental.debugModuleMutation === 'boolean' ? experimental.debugModuleMutation : Boolean(resolved.debug),
    lazyHydration: bool('experimental.lazyHydration', experimental.lazyHydration, true),
    purgeCachedData: bool('experimental.purgeCachedData', experimental.purgeCachedData, true),
    prefetchPreloadTags: bool('experimental.prefetchPreloadTags', experimental.prefetchPreloadTags, false),
    granularCachedData: bool('experimental.granularCachedData', experimental.granularCachedData, true),
    alwaysRunFetchOnKeyChange: bool('experimental.alwaysRunFetchOnKeyChange', experimental.alwaysRunFetchOnKeyChange, false),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    parseErrorData: true,
    pendingWhenIdle: bool('experimental.pendingWhenIdle', experimental.pendingWhenIdle, false),
    extractAsyncDataHandlers: bool('experimental.extractAsyncDataHandlers', experimental.extractAsyncDataHandlers, false),
    nitroAutoImports: bool('experimental.nitroAutoImports', experimental.nitroAutoImports, false),
    typescriptPlugin: bool('experimental.typescriptPlugin', experimental.typescriptPlugin, false),
    ssrStreaming: {
      enabled: ssrStreamingEnabled,
      botRegex: ssrStreamingEnabled && ssrStreaming?.botRegex instanceof RegExp ? ssrStreaming.botRegex : DEFAULT_BOT_REGEX,
    },
    nitroViteEnvironment: resolveNitroViteEnvironment(experimental.nitroViteEnvironment, resolved.builder),
    asyncCallHook: bool('experimental.asyncCallHook', experimental.asyncCallHook, false),
    clientNodePlaceholder: bool('experimental.clientNodePlaceholder', experimental.clientNodePlaceholder, true),
  } as NuxtOptions['experimental']
}

function resolveEmitRouteChunkError (value: unknown): NuxtOptions['experimental']['emitRouteChunkError'] {
  if (value === true) {
    return 'manual'
  }
  if (value === false) {
    return false
  }
  return EMIT_ROUTE_CHUNK_ERROR_VALUES.includes(value as typeof EMIT_ROUTE_CHUNK_ERROR_VALUES[number])
    ? value as typeof EMIT_ROUTE_CHUNK_ERROR_VALUES[number]
    : 'automatic'
}

function resolvePrerenderErrorPages (value: unknown): boolean | number[] {
  if (!Array.isArray(value)) {
    return !!value
  }
  return value.filter((status) => {
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      return true
    }
    optionsDiagnostics.NUXT_B5020({ status: String(status) })
    return false
  })
}

function resolveNitroViteEnvironment (value: unknown, builder: NuxtOptions['builder']): boolean {
  if (value === false) {
    return false
  }
  if (builder !== '@nuxt/vite-builder') {
    if (value === true) {
      optionsDiagnostics.NUXT_B5027()
    }
    return false
  }
  return true
}
