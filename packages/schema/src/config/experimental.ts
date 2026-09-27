import { schemaDiagnostics } from '../diagnostics.ts'
import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  future: {
    compatibilityVersion: {
      $resolve: (val) => {
        if (val !== undefined && val !== 5) {
          schemaDiagnostics.NUXT_B5029({ value: String(val) })
        }
        return 5 as const
      },
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
          (await get('ssr')) === false
        ) {
          return false
        }
        // Enabled by default for prod with ssr (for vue components)
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
    strictRouteTypes: {
      $resolve: val => val === 'isomorphic' || typeof val === 'boolean' ? val : false,
    },
    runtimeBaseURL: false,
    decorators: false,
    asyncEntry: {
      $resolve: val => typeof val === 'boolean' ? val : false,
    },

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
    noVueServer: false,
    /**
     * Extract the data payloads of prerendered and ISR/SWR pages into `_payload.json` files that are reused during client-side navigation.
     *
     * - `'client'`: inline the payload in the HTML for the initial render and extract it to a `_payload.json` file for client-side navigation.
     * - `true`: extract the payload to a `_payload.json` file for both the initial render and client-side navigation.
     * - `false`: disable payload extraction entirely; the payload is always inlined in the HTML.
     *
     * Defaults to `'client'`. It is forced to `false` when `ssr` is disabled.
     * @see [Payload Extraction documentation](https://nuxt.com/docs/getting-started/prerendering#payload-extraction)
     */
    payloadExtraction: {
      $resolve: async (val, get) => {
        if ((await get('ssr')) === false) { return false }
        if (val === 'client' || typeof val === 'boolean') { return val }
        return 'client' as const
      },
    },
    /**
     * Render the error page in the Nuxt renderer itself when a server render fails, rather than
     * handing the error to the server runtime and re-entering the renderer over an internal request.
     *
     * The error page is rendered in process, on the same request event, so the response keeps the
     * headers and cookies the failed render had already written.
     *
     * @default true
     */
    inlineErrorRendering: {
      $resolve: val => typeof val === 'boolean' ? val : true,
    },

    /**
     * Server-render static error pages (such as `404.html`) when prerendering, rather than emitting an empty SPA shell.
     *
     * Pass an array of status codes between 400 and 599 to control which error pages are generated. `true` is equivalent to `[404]`.
     * @type {boolean | number[]}
     */
    prerenderErrorPages: {
      $resolve: (val) => {
        if (!Array.isArray(val)) {
          return !!val
        }
        return val.filter((status) => {
          if (Number.isInteger(status) && status >= 400 && status <= 599) {
            return true
          }
          schemaDiagnostics.NUXT_B5020({ status: String(status) })
          return false
        })
      },
    },

    /**
     * Respond with an early 404 error for requests whose path cannot match any page route,
     * without loading the Vue app, its plugins or middleware on the server.
     *
     * Page routes (including aliases) are converted to route patterns at build time and
     * requests are checked against them before server-side rendering begins.
     *
     * This is opt-in as it can break apps that rely on runtime routing: pages added
     * dynamically with `router.addRoute()` (on the server or the client), or route
     * middleware that redirects unknown paths to existing ones. It also applies to
     * `ssr: false` routes, which respond with a 404 error rather than the SPA shell when
     * no page can match. The option is disabled automatically in development, when using
     * `hashMode`, with a root-level catch-all page, and when a custom `app/router.options`
     * file may modify `routes`.
     */
    early404: false,

    clientFallback: false,
    crossOriginPrefetch: false,

    /**
     * Enable View Transition API integration with client-side router.
     * @see [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions)
     * @type {ViewTransitionOptions['enabled'] | ViewTransitionOptions}
     */
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
    typedPages: {
      $resolve: val => typeof val === 'boolean' ? val : true,
    },
    serverPathFallback: {
      $resolve: val => typeof val === 'boolean' ? val : true,
    },
    appManifest: true,
    checkOutdatedBuildInterval: 1000 * 60 * 60,
    watcher: {
      $resolve: (val) => {
        const validOptions = new Set(['chokidar', 'parcel', 'chokidar-granular', 'builder'] as const)
        type WatcherOption = typeof validOptions extends Set<infer Option> ? Option : never
        if (typeof val === 'string' && validOptions.has(val as WatcherOption)) {
          return val as WatcherOption
        }
        return 'builder' as const
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
    extractSerializablePageMeta: {
      $resolve (val) {
        return typeof val === 'boolean' ? val : true
      },
    },
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
      useState: {
        resetOnClear: {
          $resolve: (val) => {
            return typeof val === 'boolean' ? val : true
          },
        },
      },
      useFetch: {},
    },
    clientNodeCompat: false,
    navigationRepaint: true,
    navigateToEarlyReturn: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    buildCache: false,
    normalizeComponentNames: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    normalizePageNames: {
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
      $resolve: (val, get) => typeof val === 'boolean' ? val : get('dev'),
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
    prefetchPreloadTags: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    granularCachedData: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    stripNeverHydratedData: false,
    alwaysRunFetchOnKeyChange: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    // TODO: remove this option, including from the schema types, before Nuxt 5 is released
    parseErrorData: {
      $resolve: (val) => {
        if (val === false) {
          schemaDiagnostics.NUXT_B5016()
        }
        return true
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
    nitroAutoImports: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    ssrStreaming: {
      $resolve (val) {
        // Indexing crawlers only; `chrome-lighthouse` is intentionally absent
        // so audit tools measure the same streamed response real users get.
        const defaultBotRegex = /bot\b|crawl|spider|slurp|facebookexternalhit|google\b|bing\b|yandex\b|baidu\b|duckduck/i
        const obj = (val !== null && typeof val === 'object') ? val as { enabled?: boolean, botRegex?: RegExp } : null
        const isEnabled = val === true || (obj !== null && obj.enabled !== false)
        if (!isEnabled) {
          return { enabled: false as const, botRegex: defaultBotRegex }
        }
        const botRegex = obj?.botRegex instanceof RegExp ? obj.botRegex : defaultBotRegex
        return { enabled: true as const, botRegex }
      },
    },
    /**
     * Run Nitro as a Vite environment using the `nitro/vite` plugin instead of
     * Nitro's own Rolldown pipeline.
     *
     * Only effective when using `@nuxt/vite-builder`.
     */
    nitroViteEnvironment: {
      $resolve: async (val, get) => {
        if (val === false) {
          return false
        }
        const builder = await get('builder')
        if (builder !== 'vite' && (builder as string) !== '@nuxt/vite-builder') {
          if (val === true) {
            schemaDiagnostics.NUXT_B5027()
          }
          return false
        }
        return true
      },
    },
    asyncCallHook: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    clientNodePlaceholder: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },
    clearBuildHooks: true,
  },
})
