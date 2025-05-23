import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  /**
   * `future` is for early opting-in to new features that will become default in a future
   * (possibly major) version of the framework.
   */
  future: {
    /**
     * Enable early access to future features or flags.
     *
     * It is currently not configurable but may be in future.
     * @type {4}
     */
    compatibilityVersion: 4,
    /**
     * This enables early access to the experimental multi-app support.
     * @see [Nuxt Issue #21635](https://github.com/nuxt/nuxt/issues/21635)
     */
    multiApp: false,
    /**
     * This enables 'Bundler' module resolution mode for TypeScript, which is the recommended setting
     * for frameworks like Nuxt and Vite.
     *
     * It improves type support when using modern libraries with `exports`.
     *
     * You can set it to false to use the legacy 'Node' mode, which is the default for TypeScript.
     *
     * @see [TypeScript PR implementing `bundler` module resolution](https://github.com/microsoft/TypeScript/pull/51669)
     */
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
  /**
   * Some features of Nuxt are available on an opt-in basis, or can be disabled based on your needs.
   */
  features: {
    /**
     * Inline styles when rendering HTML (currently vite only).
     *
     * You can also pass a function that receives the path of a Vue component
     * and returns a boolean indicating whether to inline the styles for that component.
     * @type {boolean | ((id?: string) => boolean)}
     */
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
        return val ?? ((await get('future')).compatibilityVersion === 4 ? (id?: string) => !!id && id.includes('.vue') : true)
      },
    },

    /**
     * Stream server logs to the client as you are developing. These logs can
     * be handled in the `dev:ssr-logs` hook.
     *
     * If set to `silent`, the logs will not be printed to the browser console.
     * @type {boolean | 'silent'}
     */
    devLogs: {
      async $resolve (val, get) {
        if (typeof val === 'boolean' || val === 'silent') {
          return val
        }
        const [isDev, isTest] = await Promise.all([get('dev'), get('test')])
        return isDev && !isTest
      },
    },

    /**
     * Turn off rendering of Nuxt scripts and JS resource hints.
     * You can also disable scripts more granularly within `routeRules`.
     *
     * If set to 'production' or `true`, JS will be disabled in production mode only.
     * @type {'production' | 'all' | boolean}
     */
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
    /**
     * Enable to use experimental decorators in Nuxt and Nitro.
     *
     * @see https://github.com/tc39/proposal-decorators
     */
    decorators: false,
    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     */
    asyncEntry: {
      $resolve: val => typeof val === 'boolean' ? val : false,
    },

    // TODO: Remove when nitro has support for mocking traced dependencies
    // https://github.com/nitrojs/nitro/issues/1118
    /**
     * Externalize `vue`, `@vue/*` and `vue-router` when building.
     * @see [Nuxt Issue #13632](https://github.com/nuxt/nuxt/issues/13632)
     */
    externalVue: true,

    /**
     * Enable accessing `appConfig` from server routes.
     *
     * @deprecated This option is not recommended.
     */
    serverAppConfig: false,
    /**
     * Emit `app:chunkError` hook when there is an error loading vite/webpack
     * chunks.
     *
     * By default, Nuxt will also perform a reload of the new route
     * when a chunk fails to load when navigating to a new route (`automatic`).
     *
     * Setting `automatic-immediate` will lead Nuxt to perform a reload of the current route
     * right when a chunk fails to load (instead of waiting for navigation).
     *
     * You can disable automatic handling by setting this to `false`, or handle
     * chunk errors manually by setting it to `manual`.
     * @see [Nuxt PR #19038](https://github.com/nuxt/nuxt/pull/19038)
     * @type {false | 'manual' | 'automatic' | 'automatic-immediate'}
     */
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

    /**
     * By default the route object returned by the auto-imported `useRoute()` composable
     * is kept in sync with the current page in view in `<NuxtPage>`. This is not true for
     * `vue-router`'s exported `useRoute` or for the default `$route` object available in your
     * Vue templates.
     *
     * By enabling this option a mixin will be injected to keep the `$route` template object
     * in sync with Nuxt's managed `useRoute()`.
     */
    templateRouteInjection: true,

    /**
     * Whether to restore Nuxt app state from `sessionStorage` when reloading the page
     * after a chunk error or manual `reloadNuxtApp()` call.
     *
     * To avoid hydration errors, it will be applied only after the Vue app has been mounted,
     * meaning there may be a flicker on initial load.
     *
     * Consider carefully before enabling this as it can cause unexpected behavior, and
     * consider providing explicit keys to `useState` as auto-generated keys may not match
     * across builds.
     * @type {boolean}
     */
    restoreState: false,

    /** Render JSON payloads with support for revivifying complex types. */
    renderJsonPayloads: true,

    /**
     * Disable vue server renderer endpoint within nitro.
     */
    noVueServer: false,

    /**
     * When this option is enabled (by default) payload of pages that are prerendered are extracted
     * @type {boolean | undefined}
     */
    payloadExtraction: true,

    /**
     * Whether to enable the experimental `<NuxtClientFallback>` component for rendering content on the client
     * if there's an error in SSR.
     */
    clientFallback: false,

    /** Enable cross-origin prefetch using the Speculation Rules API. */
    crossOriginPrefetch: false,

    /**
     * Enable View Transition API integration with client-side router.
     * @see [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions)
     * @type {boolean | 'always'}
     */
    viewTransition: false,

    /**
     * Write early hints when using node server.
     * @note nginx does not support 103 Early hints in the current version.
     */
    writeEarlyHints: false,

    /**
     * Experimental component islands support with `<NuxtIsland>` and `.island.vue` files.
     *
     * By default it is set to 'auto', which means it will be enabled only when there are islands,
     * server components or server pages in your app.
     * @type {true | 'auto' | 'local' | 'local+remote' | Partial<{ remoteIsland: boolean, selectiveClient: boolean | 'deep' }> | false}
     */
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

    /** Resolve `~`, `~~`, `@` and `@@` aliases located within layers with respect to their layer source and root directories. */
    localLayerAliases: true,

    /** Enable the new experimental typed router using [unplugin-vue-router](https://github.com/posva/unplugin-vue-router). */
    typedPages: false,

    /**
     * Use app manifests to respect route rules on client-side.
     */
    appManifest: true,

    /**
     * Set the time interval (in ms) to check for new builds. Disabled when `experimental.appManifest` is `false`.
     *
     * Set to `false` to disable.
     * @type {number | false}
     */
    checkOutdatedBuildInterval: 1000 * 60 * 60,

    /**
     * Set an alternative watcher that will be used as the watching service for Nuxt.
     *
     * Nuxt uses 'chokidar-granular' if your source directory is the same as your root
     * directory . This will ignore top-level directories (like `node_modules` and `.git`)
     * that are excluded from watching.
     *
     * You can set this instead to `parcel` to use `@parcel/watcher`, which may improve
     * performance in large projects or on Windows platforms.
     *
     * You can also set this to `chokidar` to watch all files in your source directory.
     * @see [chokidar](https://github.com/paulmillr/chokidar)
     * @see [@parcel/watcher](https://github.com/parcel-bundler/watcher)
     * @type {'chokidar' | 'parcel' | 'chokidar-granular'}
     */
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

    /**
     * Enable native async context to be accessible for nested composables
     * @see [Nuxt PR #20918](https://github.com/nuxt/nuxt/pull/20918)
     */
    asyncContext: false,

    /**
     * Use new experimental head optimisations:
     *
     * - Add the capo.js head plugin in order to render tags in of the head in a more performant way.
     * - Uses the hash hydration plugin to reduce initial hydration
     *
     * @see [Nuxt Discussion #22632](https://github.com/nuxt/nuxt/discussions/22632)
     */
    headNext: true,

    /**
     * Allow defining `routeRules` directly within your `~/pages` directory using `defineRouteRules`.
     *
     * Rules are converted (based on the path) and applied for server requests. For example, a rule
     * defined in `~/pages/foo/bar.vue` will be applied to `/foo/bar` requests. A rule in `~/pages/foo/[id].vue`
     * will be applied to `/foo/**` requests.
     *
     * For more control, such as if you are using a custom `path` or `alias` set in the page's `definePageMeta`, you
     * should set `routeRules` directly within your `nuxt.config`.
     */
    inlineRouteRules: false,

    /**
     * Allow exposing some route metadata defined in `definePageMeta` at build-time to modules (alias, name, path, redirect, props, middleware).
     *
     * This only works with static or strings/arrays rather than variables or conditional assignment.
     *
     * @see [Nuxt Issues #24770](https://github.com/nuxt/nuxt/issues/24770)
     * @type {boolean | 'after-resolve'}
     */
    scanPageMeta: {
      async $resolve (val, get) {
        return typeof val === 'boolean' || val === 'after-resolve' ? val : ((await get('future')).compatibilityVersion === 4 ? 'after-resolve' : true)
      },
    },

    /**
     * Configure additional keys to extract from the page metadata when using `scanPageMeta`.
     *
     * This allows modules to access additional metadata from the page metadata. It's recommended
     * to augment the NuxtPage types with your keys.
     *
     * @type {string[]}
     */
    extraPageMetaExtractionKeys: [],

    /**
     * Automatically share payload _data_ between pages that are prerendered. This can result in a significant
     * performance improvement when prerendering sites that use `useAsyncData` or `useFetch` and fetch the same
     * data in different pages.
     *
     * It is particularly important when enabling this feature to make sure that any unique key of your data
     * is always resolvable to the same data. For example, if you are using `useAsyncData` to fetch
     * data related to a particular page, you should provide a key that uniquely matches that data. (`useFetch`
     * should do this automatically for you.)
     * @example
     * ```ts
     * // This would be unsafe in a dynamic page (e.g. `[slug].vue`) because the route slug makes a difference
     * // to the data fetched, but Nuxt can't know that because it's not reflected in the key.
     * const route = useRoute()
     * const { data } = await useAsyncData(async () => {
     *   return await $fetch(`/api/my-page/${route.params.slug}`)
     * })
     * // Instead, you should use a key that uniquely identifies the data fetched.
     * const { data } = await useAsyncData(route.params.slug, async () => {
     *   return await $fetch(`/api/my-page/${route.params.slug}`)
     * })
     * ```
     */
    sharedPrerenderData: {
      async $resolve (val, get) {
        return typeof val === 'boolean' ? val : ((await get('future')).compatibilityVersion === 4)
      },
    },

    /**
     * Enables CookieStore support to listen for cookie updates (if supported by the browser) and refresh `useCookie` ref values.
     * @see [CookieStore](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore)
     */
    cookieStore: true,

    /**
     * This allows specifying the default options for core Nuxt components and composables.
     *
     * These options will likely be moved elsewhere in the future, such as into `app.config` or into the
     * `app/` directory.
     */
    defaults: {
      /** @type {typeof import('nuxt/app')['NuxtLinkOptions']} */
      nuxtLink: {
        componentName: 'NuxtLink',
        prefetch: true,
        prefetchOn: {
          visibility: true,
        },
      },
      /**
       * Options that apply to `useAsyncData` (and also therefore `useFetch`)
       */
      useAsyncData: {
        deep: false,
      },
      /** @type {Pick<typeof import('ofetch')['FetchOptions'], 'timeout' | 'retry' | 'retryDelay' | 'retryStatusCodes'>} */
      useFetch: {},
    },

    /**
     * Automatically polyfill Node.js imports in the client build using `unenv`.
     * @see [unenv](https://github.com/unjs/unenv)
     *
     * **Note:** To make globals like `Buffer` work in the browser, you need to manually inject them.
     *
     * ```ts
     * import { Buffer } from 'node:buffer'
     *
     * globalThis.Buffer = globalThis.Buffer || Buffer
     * ```
     * @type {boolean}
     */
    clientNodeCompat: false,

    /**
     * Wait for a single animation frame before navigation, which gives an opportunity
     * for the browser to repaint, acknowledging user interaction.
     *
     * It can reduce INP when navigating on prerendered routes.
     */
    navigationRepaint: true,

    /**
     * Cache Nuxt/Nitro build artifacts based on a hash of the configuration and source files.
     *
     * This only works for source files within `srcDir` and `serverDir` for the Vue/Nitro parts of your app.
     */
    buildCache: false,

    /**
     * Ensure that auto-generated Vue component names match the full component name
     * you would use to auto-import the component.
     */
    normalizeComponentNames: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : ((await get('future')).compatibilityVersion === 4)
      },
    },

    /**
     * Keep showing the spa-loading-template until suspense:resolve
     * @see [Nuxt Issues #21721](https://github.com/nuxt/nuxt/issues/21721)
     * @type {'body' | 'within'}
     */
    spaLoadingTemplateLocation: {
      $resolve: async (val, get) => {
        const validOptions = new Set(['body', 'within'] as const)
        type SpaLoadingTemplateLocation = typeof validOptions extends Set<infer Option> ? Option : never
        return typeof val === 'string' && validOptions.has(val as SpaLoadingTemplateLocation) ? val as SpaLoadingTemplateLocation : (((await get('future')).compatibilityVersion === 4) ? 'body' : 'within')
      },
    },

    /**
     * Enable timings for Nuxt application hooks in the performance panel of Chromium-based browsers.
     *
     * This feature adds performance markers for Nuxt hooks, allowing you to track their execution time
     * in the browser's Performance tab. This is particularly useful for debugging performance issues.
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Enable performance markers for Nuxt hooks in browser devtools
     *     browserDevtoolsTiming: true
     *   }
     * })
     * ```
     *
     * @see [PR #29922](https://github.com/nuxt/nuxt/pull/29922)
     * @see [Chrome DevTools Performance API](https://developer.chrome.com/docs/devtools/performance/extension#tracks)
     */
    browserDevtoolsTiming: {
      $resolve: async (val, get) => typeof val === 'boolean' ? val : await get('dev'),
    },

    /**
     * Record mutations to `nuxt.options` in module context, helping to debug configuration changes
     * made by modules during the Nuxt initialization phase.
     *
     * When enabled, Nuxt will track which modules modify configuration options, making it
     * easier to trace unexpected configuration changes.
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Enable tracking of config mutations by modules
     *     debugModuleMutation: true
     *   }
     * })
     * ```
     *
     * @see [PR #30555](https://github.com/nuxt/nuxt/pull/30555)
     */
    debugModuleMutation: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : Boolean(await get('debug'))
      },
    },

    /**
     * Enable automatic configuration of hydration strategies for `<Lazy>` components.
     *
     * This feature intelligently determines when to hydrate lazy components based on
     * visibility, idle time, or other triggers, improving performance by deferring
     * hydration of components until they're needed.
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     lazyHydration: true // Enable smart hydration strategies for Lazy components
     *   }
     * })
     *
     * // In your Vue components
     * <template>
     *   <Lazy>
     *     <ExpensiveComponent />
     *   </Lazy>
     * </template>
     * ```
     *
     * @see [PR #26468](https://github.com/nuxt/nuxt/pull/26468)
     */
    lazyHydration: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },

    /**
     * Disable resolving imports into Nuxt templates from the path of the module that added the template.
     *
     * By default, Nuxt attempts to resolve imports in templates relative to the module that added them.
     * Setting this to `false` disables this behavior, which may be useful if you're experiencing
     * resolution conflicts in certain environments.
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Disable template import resolution from module path
     *     templateImportResolution: false
     *   }
     * })
     * ```
     *
     * @see [PR #31175](https://github.com/nuxt/nuxt/pull/31175)
     */
    templateImportResolution: true,

    /**
     * Whether to clean up Nuxt static and asyncData caches on route navigation.
     *
     * Nuxt will automatically purge cached data from `useAsyncData` and `nuxtApp.static.data`. This helps prevent memory leaks
     * and ensures fresh data is loaded when needed, but it is possible to disable it.
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Disable automatic cache cleanup (default is true)
     *     purgeCachedData: false
     *   }
     * })
     * ```
     *
     * @see [PR #31379](https://github.com/nuxt/nuxt/pull/31379)
     */
    purgeCachedData: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : true
      },
    },

    /**
     * Whether to call and use the result from `getCachedData` on manual refresh for `useAsyncData` and `useFetch`.
     */
    granularCachedData: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : ((await get('future')).compatibilityVersion === 4)
      },
    },

    /**
     * Whether to run `useFetch` when the key changes, even if it is set to `immediate: false` and it has not been triggered yet.
     *
     * `useFetch` and `useAsyncData` will always run when the key changes if `immediate: true` or if it has been already triggered.
     */
    alwaysRunFetchOnKeyChange: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : ((await get('future')).compatibilityVersion !== 4)
      },
    },

    /**
     * Whether to parse `error.data` when rendering a server error page.
     */
    parseErrorData: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : (await get('future')).compatibilityVersion === 4
      },
    },

    /**
     * Whether Nuxt should stop if a Nuxt module is incompatible.
     */
    enforceModuleCompatibility: false,

    /**
     * For `useAsyncData` and `useFetch`, whether `pending` should be `true` when data has not yet started to be fetched.
     */
    pendingWhenIdle: {
      $resolve: async (val, get) => {
        return typeof val === 'boolean' ? val : (await get('future')).compatibilityVersion !== 4
      },
    },
  },
})
