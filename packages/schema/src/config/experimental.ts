import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  experimental: {
    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     */
    asyncEntry: {
      $resolve: (val) => val ?? false
    },

    /**
     * Enable Vue's reactivity transform
     * @see https://vuejs.org/guide/extras/reactivity-transform.html
     */
    reactivityTransform: false,

    // TODO: Remove in v3.5 when nitro has support for mocking traced dependencies
    // https://github.com/unjs/nitro/issues/1118
    /**
     * Externalize `vue`, `@vue/*` and `vue-router` when building.
     * @see https://github.com/nuxt/nuxt/issues/13632
     */
    externalVue: true,

    // TODO: move to `vue.runtimeCompiler` in v3.5
    /**
     * Include Vue compiler in runtime bundle.
     */
    runtimeVueCompiler: false,

    /**
     * Tree shakes contents of client-only components from server bundle.
     * @see https://github.com/nuxt/framework/pull/5750
     */
    treeshakeClientOnly: true,

    /**
     * Emit `app:chunkError` hook when there is an error loading vite/webpack
     * chunks.
     *
     * By default, Nuxt will also perform a hard reload of the new route
     * when a chunk fails to load when navigating to a new route.
     *
     * You can disable automatic handling by setting this to `false`, or handle
     * chunk errors manually by setting it to `manual`.
     *
     * @see https://github.com/nuxt/nuxt/pull/19038
     * @type {false | 'manual' | 'automatic'}
     */
    emitRouteChunkError: {
      $resolve: val => {
        if (val === true) {
          return 'manual'
        }
        if (val === 'reload') {
          return 'automatic'
        }
        return val ?? 'automatic'
      },
    },

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
     *
     * @type {boolean}
     */
    restoreState: false,

    /**
     * Inline styles when rendering HTML (currently vite only).
     *
     * You can also pass a function that receives the path of a Vue component
     * and returns a boolean indicating whether to inline the styles for that component.
     *
     * @type {boolean | ((id?: string) => boolean)}
     */
    inlineSSRStyles: {
      async $resolve (val, get) {
        if (val === false || (await get('dev')) || (await get('ssr')) === false || (await get('builder')) === '@nuxt/webpack-builder') {
          return false
        }
        // Enabled by default for vite prod with ssr
        return val ?? true
      }
    },

    /**
     * Turn off rendering of Nuxt scripts and JS resource hints.
     */
    noScripts: false,

    /**
     * Disable vue server renderer endpoint within nitro.
    */
    noVueServer: false,

    /**
     * When this option is enabled (by default) payload of pages generated with `nuxt generate` are extracted
     */
    payloadExtraction: undefined,

    /**
     * Whether to enable the experimental `<NuxtClientFallback>` component for rendering content on the client
     * if there's an error in SSR.
     */
    clientFallback: false,

    /** Enable cross-origin prefetch using the Speculation Rules API. */
    crossOriginPrefetch: false,

    /**
     * Write early hints when using node server.
     *
     * @note nginx does not support 103 Early hints in the current version.
     */
    writeEarlyHints: false,

    /**
     * Experimental component islands support with <NuxtIsland> and .island.vue files.
     */
    componentIslands: false,

    /**
     * Config schema support
     *
     * @see https://github.com/nuxt/nuxt/issues/15592
     */
    configSchema: true,

    /**
     * Whether or not to add a compatibility layer for modules, plugins or user code relying on the old
     * `@vueuse/head` API.
     *
     * This can be disabled for most Nuxt sites to reduce the client-side bundle by ~0.5kb.
     */
    polyfillVueUseHead: true,

    /** Allow disabling Nuxt SSR responses by setting the `x-nuxt-no-ssr` header. */
    respectNoSSRHeader: false,

    /** Resolve `~`, `~~`, `@` and `@@` aliases located within layers with respect to their layer source and root directories. */
    localLayerAliases: true,
  }
})
