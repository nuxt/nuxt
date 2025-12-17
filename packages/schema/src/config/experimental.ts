import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  future: {
    compatibilityVersion: {
      // force resolution to `4` no matter what users pass
      $resolve: val => typeof val === 'number' ? val as 4 | 5 : 4,
    },
    multiApp: false,
    typescriptBundlerResolution: {
      async $resolve (val, get) {
        // @ts-expect-error TODO: remove in v3.10
        val = typeof val === 'boolean' ? val : await (get('experimental')).then(e => e?.typescriptBundlerResolution as string | undefined)
        if (typeof val === 'boolean') { return val }
        const setting = await get('typescript.tsConfig').then(r => r?.compilerOptions?.moduleResolution)
        if (setting) {
          return setting.toLowerCase() === 'bundler'
        }
        return true
      },
    },
  },
  features: {
    inlineStyles: {
      async $resolve (_val, get) {
        const val = typeof _val === 'boolean' || typeof _val === 'function'
          ? _val
          // @ts-expect-error TODO: legacy property - remove in v3.10
          : await (get('experimental')).then(e => e?.inlineSSRStyles) as undefined | boolean
        if (
          val === false ||
          (await get('dev')) ||
          (await get('ssr')) === false ||
          // @ts-expect-error TODO: handled normalised types
          (await get('builder')) === '@nuxt/webpack-builder'
        ) {
          return false
        }
        // Enabled by default for vite prod with ssr (for vue components)
        return val ?? ((id?: string) => !!id && id.includes('.vue'))
      },
    },
    devLogs: {
      async $resolve (val, get) {
        if (typeof val === 'boolean' || val === 'silent') {
          return val
        }
        const [isDev, isTest] = await Promise.all([get('dev'), get('test')])
        return isDev && !isTest
      },
    },
    noScripts: {
      async $resolve (val, get) {
        const isValidLiteral = (val: unknown): val is 'production' | 'all' => {
          return typeof val === 'string' && ['production', 'all'].includes(val)
        }
        return val === true
          ? 'production'
          : val === false || isValidLiteral(val)
            ? val
            // @ts-expect-error TODO: legacy property - remove in v3.10
            : (await (get('experimental')).then(e => e?.noScripts as boolean | undefined && 'production') ?? false)
      },
    },
  },
  experimental: {
    runtimeBaseURL: false,
    decorators: false,
    asyncEntry: {
      $resolve: val => typeof val === 'boolean' ? val : false,
    },

    // TODO: Remove when nitro has support for mocking traced dependencies
    // https://github.com/nitrojs/nitro/issues/1118
    externalVue: true,
    serverAppConfig: true,
    emitRouteChunkError: {
      $resolve: (val) => {
        if (val === true) {
          return 'manual'
        }
        if (val === 'reload') {
          return 'automatic'
        }
        if (val === false) {
          return false
        }

        const validOptions = new Set(['manual', 'automatic', 'automatic-immediate'] as const)
        type EmitRouteChunkError = typeof validOptions extends Set<infer Option> ? Option : never
        if (typeof val === 'string' && validOptions.has(val as EmitRouteChunkError)) {
          return val as EmitRouteChunkError
        }

        return 'automatic'
      },
    },
    templateRouteInjection: true,
    restoreState: false,
    renderJsonPayloads: true,
    noVueServer: false,
    payloadExtraction: true,
    clientFallback: false,
    crossOriginPrefetch: false,
    viewTransition: false,
    writeEarlyHints: false,
    componentIslands: {
      $resolve: (val) => {
        if (val === 'local+remote') {
          return { remoteIsland: true }
        }
        if (val === 'local') {
          return true
        }
        return val ?? 'auto'
      },
    },
    localLayerAliases: true,
    typedPages: false,
    appManifest: true,
    checkOutdatedBuildInterval: 1000 * 60 * 60,
    watcher: {
      $resolve: async (val, get) => {
        const validOptions = new Set(['chokidar', 'parcel', 'chokidar-granular'] as const)
        type WatcherOption = typeof validOptions extends Set<infer Option> ? Option : never
        if (typeof val === 'string' && validOptions.has(val as WatcherOption)) {
          return val as WatcherOption
        }
        const [srcDir, rootDir] = await Promise.all([get('srcDir'), get('rootDir')])
        if (srcDir === rootDir) {
          return 'chokidar-granular' as const
        }
        return 'chokidar' as const
      },
    },
    asyncContext: false,
    headNext: true,
    inlineRouteRules: false,
    scanPageMeta: {
      $resolve (val) {
        return typeof val === 'boolean' || val === 'after-resolve' ? val : 'after-resolve'
      },
    },
    extraPageMetaExtractionKeys: [],
    sharedPrerenderData: {
      $resolve (val) {
        return typeof val === 'boolean' ? val : true
      },
    },
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
    normalizeComponentNames: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    spaLoadingTemplateLocation: {
      $resolve: (val) => {
        const validOptions = new Set(['body', 'within'] as const)
        type SpaLoadingTemplateLocation = typeof validOptions extends Set<infer Option> ? Option : never
        return typeof val === 'string' && validOptions.has(val as SpaLoadingTemplateLocation) ? val as SpaLoadingTemplateLocation : 'body'
      },
    },
    browserDevtoolsTiming: {
      $resolve: async (val, get) => typeof val === 'boolean' ? val : await get('dev'),
    },
    chromeDevtoolsProjectSettings: true,
    debugModuleMutation: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : Boolean(await get('debug'))
      },
    },
    lazyHydration: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    templateImportResolution: true,
    purgeCachedData: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    granularCachedData: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    alwaysRunFetchOnKeyChange: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    parseErrorData: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    enforceModuleCompatibility: false,
    pendingWhenIdle: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    entryImportMap: true,
    extractAsyncDataHandlers: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    viteEnvironmentApi: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : (await get('future.compatibilityVersion')) >= 5
      },
    },
  },
})
